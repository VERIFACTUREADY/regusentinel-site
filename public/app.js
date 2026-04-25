// === Mentes Maestras · frontend ===

const els = {
  grid: document.getElementById("figures-grid"),
  selectedLine: document.getElementById("selected-line"),
  form: document.getElementById("ask-form"),
  textarea: document.getElementById("question"),
  charCount: document.getElementById("char-count"),
  askBtn: document.getElementById("ask-btn"),
  response: document.getElementById("response"),
  responseAvatar: document.getElementById("response-avatar"),
  responseName: document.getElementById("response-name"),
  responseMeta: document.getElementById("response-meta"),
  responseBody: document.getElementById("response-body"),
  responseFooter: document.getElementById("response-footer"),
  copyBtn: document.getElementById("copy-btn"),
  newBtn: document.getElementById("new-btn"),
  errorBox: document.getElementById("error-box")
};

const state = {
  figures: [],
  selected: null,
  isStreaming: false,
  fullText: ""
};

const MAX_CHARS = 4000;

// ----- Cargar figuras -----
async function loadFigures() {
  try {
    const res = await fetch("/api/figures");
    if (!res.ok) throw new Error("No se pudieron cargar las figuras.");
    const { figures } = await res.json();
    state.figures = figures;
    renderFigures();
  } catch (err) {
    els.grid.innerHTML = `<div class="figures-loading">Error: ${escapeHtml(err.message)}</div>`;
  }
}

function renderFigures() {
  els.grid.innerHTML = "";
  for (const f of state.figures) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "figure-card";
    card.style.setProperty("--card-color", f.color);
    card.dataset.id = f.id;
    card.innerHTML = `
      <span class="figure-avatar">${escapeHtml(f.avatar)}</span>
      <div>
        <div class="figure-name">${escapeHtml(f.name)}</div>
        <div class="figure-meta">${escapeHtml(f.era)} · ${escapeHtml(f.field)}</div>
      </div>
      <p class="figure-tagline">${escapeHtml(f.tagline)}</p>
    `;
    card.addEventListener("click", () => selectFigure(f.id));
    els.grid.appendChild(card);
  }
}

function selectFigure(id) {
  state.selected = state.figures.find((f) => f.id === id) || null;
  for (const card of els.grid.querySelectorAll(".figure-card")) {
    card.classList.toggle("is-selected", card.dataset.id === id);
  }
  if (state.selected) {
    els.selectedLine.innerHTML = `Vas a consultar a <strong style="color:${state.selected.color}">${escapeHtml(state.selected.name)}</strong>. Cuéntale tu situación.`;
    els.textarea.focus({ preventScroll: true });
    document.getElementById("consulta").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  updateAskBtn();
}

// ----- Textarea -----
els.textarea.addEventListener("input", () => {
  const len = els.textarea.value.length;
  els.charCount.textContent = `${len.toLocaleString("es-ES")} / ${MAX_CHARS.toLocaleString("es-ES")}`;
  els.charCount.style.color = len > MAX_CHARS * 0.9 ? "var(--danger)" : "var(--text-mute)";
  updateAskBtn();
});

function updateAskBtn() {
  const len = els.textarea.value.trim().length;
  els.askBtn.disabled = !state.selected || len === 0 || state.isStreaming;
}

// ----- Submit -----
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!state.selected || state.isStreaming) return;
  const question = els.textarea.value.trim();
  if (!question) return;
  ask(question);
});

async function ask(question) {
  hideError();
  state.isStreaming = true;
  state.fullText = "";
  els.askBtn.classList.add("is-loading");
  updateAskBtn();

  // Preparar tarjeta de respuesta
  els.response.hidden = false;
  els.responseFooter.hidden = true;
  els.responseAvatar.textContent = state.selected.avatar;
  els.responseAvatar.style.background = state.selected.color;
  els.response.style.setProperty("--card-color", state.selected.color);
  els.responseName.textContent = state.selected.name;
  els.responseMeta.textContent = `${state.selected.era} · ${state.selected.field}`;
  els.responseBody.innerHTML = '<span class="cursor"></span>';
  els.response.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ figureId: state.selected.id, question })
    });

    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }

    await consumeSSE(res.body);
  } catch (err) {
    showError(err.message || "Error al consultar.");
    els.response.hidden = true;
  } finally {
    state.isStreaming = false;
    els.askBtn.classList.remove("is-loading");
    updateAskBtn();
  }
}

async function consumeSSE(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      handleSSE(rawEvent);
    }
  }
}

function handleSSE(rawEvent) {
  const lines = rawEvent.split("\n");
  let event = "message";
  let dataStr = "";
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
  }
  if (!dataStr) return;
  let data;
  try {
    data = JSON.parse(dataStr);
  } catch {
    return;
  }

  if (event === "delta") {
    state.fullText += data.text || "";
    renderStreamingBody(state.fullText, true);
  } else if (event === "done") {
    renderStreamingBody(state.fullText, false);
    els.responseFooter.hidden = false;
  } else if (event === "error") {
    showError(data.message || "Error del servidor.");
  }
}

// Render con markdown ligero (negrita, cursiva, listas con * o -)
function renderStreamingBody(text, withCursor) {
  const html = mdToHtml(text);
  els.responseBody.innerHTML = html + (withCursor ? '<span class="cursor"></span>' : "");
}

function mdToHtml(md) {
  const escaped = escapeHtml(md);
  const lines = escaped.split("\n");
  const out = [];
  let inList = false;
  let listType = null; // 'ul' o 'ol'

  const closeList = () => {
    if (inList) {
      out.push(`</${listType}>`);
      inList = false;
      listType = null;
    }
  };

  for (let line of lines) {
    const trimmed = line.trim();
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);

    if (ulMatch) {
      if (!inList || listType !== "ul") {
        closeList();
        out.push("<ul>");
        inList = true;
        listType = "ul";
      }
      out.push(`<li>${inlineMd(ulMatch[1])}</li>`);
    } else if (olMatch) {
      if (!inList || listType !== "ol") {
        closeList();
        out.push("<ol>");
        inList = true;
        listType = "ol";
      }
      out.push(`<li>${inlineMd(olMatch[2])}</li>`);
    } else if (trimmed === "") {
      closeList();
      out.push("");
    } else {
      closeList();
      out.push(`<p>${inlineMd(line)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}

function inlineMd(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\n]+)_/g, "$1<em>$2</em>");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showError(msg) {
  els.errorBox.textContent = msg;
  els.errorBox.hidden = false;
}

function hideError() {
  els.errorBox.hidden = true;
}

// ----- Footer actions -----
els.copyBtn.addEventListener("click", async () => {
  if (!state.fullText) return;
  try {
    await navigator.clipboard.writeText(state.fullText);
    const original = els.copyBtn.textContent;
    els.copyBtn.textContent = "✓ Copiado";
    setTimeout(() => (els.copyBtn.textContent = original), 1600);
  } catch {
    showError("No se pudo copiar al portapapeles.");
  }
});

els.newBtn.addEventListener("click", () => {
  els.textarea.value = "";
  els.textarea.dispatchEvent(new Event("input"));
  els.response.hidden = true;
  state.fullText = "";
  els.textarea.focus();
  document.getElementById("consulta").scrollIntoView({ behavior: "smooth", block: "start" });
});

// ----- Init -----
loadFigures();
