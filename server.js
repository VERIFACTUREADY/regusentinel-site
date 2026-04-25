import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

import { figures, figuresById, figuresPublic } from "./data/figures.js";
import { buildSystemPrompt, buildUserMessage } from "./src/prompt.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.warn(
    "\n[Mentes Maestras] AVISO: no hay ANTHROPIC_API_KEY definida. " +
      "Las consultas devolverán error 500 hasta que la añadas a .env\n"
  );
}

const anthropic = API_KEY ? new Anthropic({ apiKey: API_KEY }) : null;

const app = express();
app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/figures", (_req, res) => {
  res.json({ figures: figuresPublic });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    model: MODEL,
    figures: figures.length,
    apiKeyConfigured: Boolean(API_KEY)
  });
});

app.post("/api/ask", async (req, res) => {
  const { figureId, question } = req.body || {};
  const figure = figureId && figuresById[figureId];
  if (!figure) {
    return res.status(400).json({ error: "Figura no válida." });
  }
  const trimmed = typeof question === "string" ? question.trim() : "";
  if (!trimmed) {
    return res.status(400).json({ error: "La pregunta está vacía." });
  }
  if (trimmed.length > 4000) {
    return res
      .status(400)
      .json({ error: "La pregunta es demasiado larga (máx 4000 caracteres)." });
  }

  if (!anthropic) {
    return res.status(500).json({
      error:
        "El servidor no tiene configurada ANTHROPIC_API_KEY. Añádela en el archivo .env y reinicia."
    });
  }

  // Streaming via Server-Sent Events.
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 1400,
      system: buildSystemPrompt(figure),
      messages: [
        {
          role: "user",
          content: buildUserMessage(trimmed)
        }
      ]
    });

    stream.on("text", (delta) => {
      if (closed) return;
      send("delta", { text: delta });
    });

    const final = await stream.finalMessage();
    if (!closed) {
      send("done", {
        stop_reason: final.stop_reason,
        usage: final.usage
      });
      res.end();
    }
  } catch (err) {
    console.error("[/api/ask] error:", err);
    if (!closed) {
      send("error", {
        message:
          err?.error?.error?.message ||
          err?.message ||
          "Error desconocido al consultar la API."
      });
      res.end();
    }
  }
});

// Fallback SPA: cualquier ruta desconocida devuelve el index.html.
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(
    `\n  Mentes Maestras escuchando en http://localhost:${PORT}` +
      `\n  Modelo: ${MODEL}` +
      `\n  Figuras disponibles: ${figures.length}\n`
  );
});
