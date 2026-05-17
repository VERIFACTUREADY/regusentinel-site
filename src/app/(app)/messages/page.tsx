"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import type { Metadata } from "next";

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
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/cases/${conv.caseId}/portal-messages`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setMessages(data);
        onMarkRead(conv.caseId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conv.caseId, onMarkRead]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!reply.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/cases/${conv.caseId}/portal-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error al enviar");
      }
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      setReply("");
    } catch (e: any) {
      setSendError(e.message);
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {loading ? (
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
          <p className="text-xs text-red-600 mb-2">{sendError}</p>
        )}
        <div className="flex gap-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
            }}
            placeholder="Escribe una respuesta a la familia… (⌘Enter para enviar)"
            rows={2}
            className="flex-1 px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={handleSend}
            disabled={sending || !reply.trim()}
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
  const [filter, setFilter] = useState<"all" | "unread">("unread");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadConversations = useCallback(() => {
    setLoading(true);
    const params = filter === "unread" ? "?filter=unread" : "";
    fetch(`/api/messages${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setConversations(data.conversations);
          setTotalUnread(data.totalUnread);
          if (!selectedId && data.conversations.length > 0) {
            setSelectedId(data.conversations[0].caseId);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter, selectedId]);

  useEffect(() => {
    loadConversations();
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleMarkRead(caseId: string) {
    setConversations((prev) =>
      prev.map((c) =>
        c.caseId === caseId ? { ...c, unreadCount: 0 } : c
      )
    );
    setTotalUnread((prev) => {
      const conv = conversations.find((c) => c.caseId === caseId);
      return Math.max(0, prev - (conv?.unreadCount ?? 0));
    });
  }

  const selectedConv = conversations.find((c) => c.caseId === selectedId) ?? null;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Mensajes del portal
            {totalUnread > 0 && (
              <span className="text-sm font-normal bg-primary text-white px-2 py-0.5 rounded-full">
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
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {loading ? "Cargando…" : `${conversations.length} conversacion${conversations.length !== 1 ? "es" : ""}`}
            </p>
          </div>

          {loading ? (
            <div className="flex-1 p-3 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  {conversations.length > 0 ? "Selecciona una conversación" : "No hay mensajes"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
