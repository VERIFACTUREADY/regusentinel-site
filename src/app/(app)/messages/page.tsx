"use client";

import { AvisoError } from "@/components/ui/carga-remota";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Conversation {
  caseId: string;
  caseRef: string;
  caseStatus: string;
  deceasedName: string | null;
  contactName: string | null;
  unreadCount: number;
  lastMessage: { content: string; fromFamily: boolean; createdAt: string } | null;
  messageCount: number;
}

interface PortalMessage {
  id: string;
  fromFamily: boolean;
  authorName: string | null;
  content: string;
  readAt: string | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(dateStr: string): string {
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Hace ${days}d`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + "…";
}

// ─── Message thread panel ─────────────────────────────────────────────────────

function ThreadPanel({
  conv,
  onMarkRead,
}: {
  conv: Conversation;
  onMarkRead: (caseId: string) => void;
}) {
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [errorMarcado, setErrorMarcado] = useState<string | null>(null);
  const [reintento, setReintento] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  /**
   * Marca el hilo como leído y SÓLO entonces baja el contador.
   *
   * EL DEFECTO QUE CORRIGE
   * ----------------------
   * Antes era:
   *
   *     fetch(url, { method: "PUT" }).catch(() => {});
   *     onMarkRead(conv.caseId);
   *
   * Un disparo al aire y una bajada inmediata del contador, pasara lo que
   * pasara en el servidor. El caso no es hipotético: `PUT` exige
   * `cases.update`, que un VIEWER **no tiene**. Un VIEWER abría la
   * conversación, veía desaparecer el «3 sin leer»… y al recargar volvía,
   * porque el servidor había respondido 403 y nadie se enteró. Lo mismo con un
   * 500 o con la red caída.
   *
   * Ahora el contador se mueve cuando el servidor lo confirma, y si no puede
   * se dice con un aviso que ofrece reintentar.
   */
  const marcarLeido = useCallback(async () => {
    setErrorMarcado(null);
    try {
      const res = await fetch(`/api/cases/${conv.caseId}/portal-messages`, { method: "PUT" });
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => null);
        setErrorMarcado(
          cuerpo?.error ??
            (res.status === 403
              ? "No tienes permiso para marcar los mensajes como leidos."
              : res.status === 404
                ? "El expediente ya no existe."
                : `No se ha podido marcar como leido (${res.status}).`),
        );
        return;
      }
      // Confirmado por el servidor: ahora sí baja el contador.
      onMarkRead(conv.caseId);
    } catch {
      setErrorMarcado("No se ha podido marcar como leido: error de red.");
    }
  }, [conv.caseId, onMarkRead]);

  const load = useCallback(() => {
    setLoading(true);
    setErrorCarga(null);
    fetch(`/api/cases/${conv.caseId}/portal-messages`)
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(
            r.status === 401
              ? "Tu sesion ha caducado. Vuelve a entrar."
              : r.status === 403
                ? "No tienes permiso para ver estos mensajes."
                : r.status === 404
                  ? "El expediente ya no existe."
                  : `El servidor ha respondido ${r.status}.`,
          );
        }
        return r.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error("La respuesta del servidor no tiene el formato esperado.");
        }
        setMessages(data);
        // El marcado como leido es una escritura explicita y CONFIRMADA: el
        // GET del hilo ya no muta la base de datos, y el contador no se toca
        // hasta que el servidor responde que sí.
        void marcarLeido();
      })
      .catch((e: unknown) => {
        // Un hilo vacio por un fallo de carga aparenta que el familiar no ha
        // escrito nada, que es lo contrario de lo que puede estar pasando.
        setMessages([]);
        setErrorCarga(e instanceof Error ? e.message : "Error de red. Comprueba tu conexion.");
      })
      .finally(() => setLoading(false));
  }, [conv.caseId, marcarLeido, reintento]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    // La guardia `sending` no sobra: el boton se inhabilita, pero ⌘Enter
    // dispara igual mientras la primera peticion esta en vuelo y el mensaje se
    // enviaba dos veces.
    if (sending || !reply.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/cases/${conv.caseId}/portal-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply.trim() }),
      });
      // El cuerpo se lee con red de seguridad: un 502 del proxy devuelve HTML y
      // `res.json()` a secas soltaba «Unexpected token '<'» como aviso.
      const cuerpo = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          cuerpo?.error ??
            (res.status === 403
              ? "No tienes permiso para responder en este expediente."
              : `El servidor ha respondido ${res.status}.`),
        );
      }
      if (!cuerpo || typeof cuerpo.id !== "string") {
        // Sin confirmacion del servidor NO se pinta el mensaje: verlo en
        // pantalla es, para el usuario, la prueba de que se ha enviado.
        throw new Error("El servidor no ha confirmado el envio del mensaje.");
      }
      setMessages((prev) => [...prev, cuerpo as PortalMessage]);
      setReply("");
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : "Error de red. El mensaje no se ha enviado.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="px-5 py-4 border-b bg-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Link href={`/cases/${conv.caseId}`} className="font-mono text-sm text-primary hover:underline font-semibold">
                {conv.caseRef}
              </Link>
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{conv.caseStatus}</span>
            </div>
            {conv.deceasedName && (
              <p className="text-sm text-gray-700 mt-0.5">{conv.deceasedName}</p>
            )}
            {conv.contactName && (
              <p className="text-xs text-gray-400">Contacto: {conv.contactName}</p>
            )}
          </div>
          <Link
            href={`/cases/${conv.caseId}`}
            className="shrink-0 text-xs px-3 py-1.5 border rounded-md text-gray-600 hover:bg-gray-50"
          >
            Ver expediente →
          </Link>
        </div>
      </div>

      {/* El contador no ha bajado: hay que decirlo */}
      {errorMarcado && (
        <div
          role="alert"
          data-testid="error-marcar-leido"
          className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-3"
        >
          <span>{errorMarcado} Siguen contando como sin leer.</span>
          <button
            onClick={() => void marcarLeido()}
            className="shrink-0 underline font-medium hover:text-amber-700"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Messages */}
      <div data-testid="hilo-mensajes" className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {errorCarga ? (
          <AvisoError mensaje={errorCarga} que="los mensajes" onReintentar={() => setReintento((n) => n + 1)} />
        ) : loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">Cargando mensajes...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">Sin mensajes en este expediente.</div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.fromFamily ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.fromFamily
                    ? "bg-white border text-gray-800 rounded-tl-sm"
                    : "bg-primary text-white rounded-tr-sm"
                }`}
              >
                {msg.fromFamily && msg.authorName && (
                  <p className="text-xs font-semibold text-gray-500 mb-1">{msg.authorName}</p>
                )}
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                <p className={`text-xs mt-1.5 ${msg.fromFamily ? "text-gray-400" : "text-white/70"} text-right`}>
                  {relTime(msg.createdAt)}
                  {!msg.fromFamily && " · Enviado"}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      <div className="px-4 py-3 border-t bg-white">
        {sendError && (
          <p role="alert" data-testid="error-enviar-mensaje" className="text-xs text-red-600 mb-2">
            {sendError}
          </p>
        )}
        <div className="flex gap-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
            }}
            placeholder="Escribe una respuesta a la familia… (⌘Enter para enviar)"
            aria-label="Respuesta a la familia"
            data-testid="campo-respuesta"
            rows={2}
            className="flex-1 px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={handleSend}
            disabled={sending || !reply.trim()}
            aria-label="Enviar respuesta"
            data-testid="boton-enviar-mensaje"
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 shrink-0"
          >
            {sending ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">La familia verá tu respuesta en su portal de seguimiento.</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [reintento, setReintento] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread">("unread");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /**
   * Carga la lista de conversaciones distinguiendo los cuatro estados.
   *
   * EL DEFECTO QUE CORRIGE
   * ----------------------
   * Antes era, literalmente:
   *
   *     .then((r) => (r.ok ? r.json() : null))
   *     .then((data) => { if (data) { ... } })
   *     .catch(() => {})
   *
   * Con un 401, un 403, un 500 o la red caída, `data` era `null`, el `if` no
   * entraba, `conversations` se quedaba en `[]` y la pantalla mostraba su
   * estado vacío: **«No hay mensajes sin leer»**. Indistinguible de que de
   * verdad no hubiera ninguno, y significando lo contrario: el gestor cerraba
   * tranquilo una pantalla que le estaba escondiendo a las familias esperando
   * respuesta. El `.catch(() => {})` remataba tragándose el fallo de red.
   */
  const loadConversations = useCallback(() => {
    setLoading(true);
    setErrorCarga(null);
    const params = filter === "unread" ? "?filter=unread" : "";
    fetch(`/api/messages${params}`)
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(
            r.status === 401
              ? "Tu sesion ha caducado. Vuelve a entrar."
              : r.status === 403
                ? "No tienes permiso para ver los mensajes."
                : `El servidor ha respondido ${r.status}.`,
          );
        }
        return r.json();
      })
      .then((data: unknown) => {
        // Una respuesta 200 con otra forma —un proxy, una version antigua del
        // API— dejaba `conversations` en `undefined` y la pantalla reventaba
        // al recorrerla. Se valida antes de usarla.
        const cuerpo = data as { conversations?: unknown; totalUnread?: unknown };
        if (!cuerpo || !Array.isArray(cuerpo.conversations) || typeof cuerpo.totalUnread !== "number") {
          throw new Error("La respuesta del servidor no tiene el formato esperado.");
        }
        const lista = cuerpo.conversations as Conversation[];
        setConversations(lista);
        setTotalUnread(cuerpo.totalUnread);
        setSelectedId((actual) => {
          // Se conserva la seleccion si sigue en la lista; si no, la primera.
          if (actual && lista.some((c) => c.caseId === actual)) return actual;
          return lista.length > 0 ? lista[0].caseId : null;
        });
      })
      .catch((e: unknown) => {
        // Sin datos NO se pinta el estado vacio: se pinta el fallo.
        setConversations([]);
        setTotalUnread(0);
        setSelectedId(null);
        setErrorCarga(e instanceof Error ? e.message : "Error de red. Comprueba tu conexion.");
      })
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, reintento]);

  /**
   * Baja el contador de una conversacion ya confirmada como leida.
   *
   * `setTotalUnread` leia `conversations` del CIERRE, no del estado vigente:
   * con dos marcados seguidos el segundo restaba la cifra que ya no era, y el
   * total quedaba descuadrado hasta recargar. Se resuelve todo dentro del
   * actualizador de `conversations`, que sí ve el estado real.
   */
  const handleMarkRead = useCallback((caseId: string) => {
    setConversations((prev) => {
      const conv = prev.find((c) => c.caseId === caseId);
      const restaba = conv?.unreadCount ?? 0;
      if (restaba > 0) setTotalUnread((t) => Math.max(0, t - restaba));
      return prev.map((c) => (c.caseId === caseId ? { ...c, unreadCount: 0 } : c));
    });
  }, []);

  const selectedConv = conversations.find((c) => c.caseId === selectedId) ?? null;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Mensajes del portal
            {totalUnread > 0 && (
              <span
                data-testid="total-sin-leer"
                className="text-sm font-normal bg-primary text-white px-2 py-0.5 rounded-full"
              >
                {totalUnread} sin leer
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Conversaciones con familias a través del portal de seguimiento
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {([["unread", "Sin leer"], ["all", "Todos"]] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => { setFilter(val); setSelectedId(null); }}
              data-testid={`filtro-${val}`}
              aria-pressed={filter === val}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                filter === val ? "bg-white shadow font-medium" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Split panel */}
      <div className="flex-1 flex border rounded-xl overflow-hidden bg-white min-h-0">
        {/* Conversation list */}
        <div className={`w-full sm:w-72 lg:w-80 border-r flex flex-col shrink-0 ${selectedId ? "hidden sm:flex" : "flex"}`}>
          <div className="px-4 py-3 border-b bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider" data-testid="recuento-conversaciones">
              {loading
                ? "Cargando…"
                : errorCarga
                  ? "No disponible"
                  : `${conversations.length} conversacion${conversations.length !== 1 ? "es" : ""}`}
            </p>
          </div>

          {loading ? (
            <div className="flex-1 p-3 space-y-2" data-testid="cargando-conversaciones">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : errorCarga ? (
            /*
              El fallo NUNCA se pinta como estado vacio: «No hay mensajes sin
              leer» con la peticion caida es exactamente al reves de lo que
              esta pasando.
            */
            <div className="flex-1 p-4 overflow-y-auto">
              <AvisoError
                mensaje={errorCarga}
                que="las conversaciones"
                onReintentar={() => setReintento((n) => n + 1)}
              />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center" data-testid="vacio-conversaciones">
                <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm text-gray-400">
                  {filter === "unread" ? "No hay mensajes sin leer" : "Sin conversaciones"}
                </p>
                {filter === "unread" && (
                  <button
                    onClick={() => setFilter("all")}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    Ver todas →
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {conversations.map((conv) => {
                const isSelected = conv.caseId === selectedId;
                return (
                  <button
                    key={conv.caseId}
                    onClick={() => setSelectedId(conv.caseId)}
                    data-testid={`conversacion-${conv.caseRef}`}
                    aria-current={isSelected ? "true" : undefined}
                    className={`w-full px-4 py-3 text-left border-b hover:bg-gray-50 transition ${
                      isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {conv.unreadCount > 0 && (
                            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          )}
                          <span className="font-mono text-xs font-semibold text-gray-700">{conv.caseRef}</span>
                          {conv.unreadCount > 0 && (
                            <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                        {(conv.deceasedName || conv.contactName) && (
                          <p className="text-xs text-gray-600 mt-0.5 truncate">
                            {conv.deceasedName ?? conv.contactName}
                          </p>
                        )}
                        {conv.lastMessage && (
                          <p className={`text-xs mt-0.5 truncate ${
                            conv.unreadCount > 0 ? "text-gray-800 font-medium" : "text-gray-400"
                          }`}>
                            {conv.lastMessage.fromFamily ? "" : "Tú: "}
                            {truncate(conv.lastMessage.content, 45)}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        {conv.lastMessage && (
                          <span className="text-xs text-gray-400">
                            {relTime(conv.lastMessage.createdAt)}
                          </span>
                        )}
                        <p className="text-xs text-gray-300 mt-0.5">{conv.messageCount} msg</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Thread panel */}
        <div className={`flex-1 min-w-0 ${selectedId ? "flex" : "hidden sm:flex"} flex-col`}>
          {selectedId && selectedConv ? (
            <>
              {/* Mobile back button */}
              <button
                onClick={() => setSelectedId(null)}
                className="sm:hidden flex items-center gap-1 px-4 py-2 text-sm text-primary border-b hover:bg-gray-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Volver
              </button>
              <ThreadPanel
                key={selectedId}
                conv={selectedConv}
                onMarkRead={handleMarkRead}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center p-8">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-gray-400 text-sm font-medium">
                  {errorCarga
                    ? "No se han podido cargar las conversaciones"
                    : conversations.length > 0
                      ? "Selecciona una conversación"
                      : "No hay mensajes"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
