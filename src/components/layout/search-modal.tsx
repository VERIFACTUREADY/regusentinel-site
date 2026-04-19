"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CASE_STATUS_COLORS, TASK_STATUS_COLORS } from "@/lib/constants";

interface SearchResult {
  type: "case" | "task";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  status: string;
  isUrgent?: boolean;
  category?: string;
}

export function SearchModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController>();
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
    }
  }, [open]);

  const search = useCallback((q: string) => {
    controllerRef.current?.abort();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !controller.signal.aborted) {
          setResults(data.results);
          setActiveIndex(0);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, []);

  function handleInput(value: string) {
    setQuery(value);
    search(value);
  }

  function navigate(result: SearchResult) {
    setOpen(false);
    router.push(result.href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && results[activeIndex]) {
      navigate(results[activeIndex]);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar expedientes, tareas, contactos..."
            className="flex-1 text-sm outline-none placeholder:text-gray-400"
          />
          <kbd className="hidden sm:inline text-xs text-gray-400 border rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {loading && query.length >= 2 && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Buscando...</div>
        )}

        {!loading && query.length >= 2 && results.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">
            Sin resultados para &quot;{query}&quot;
          </div>
        )}

        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto py-2">
            {results.map((result, i) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => navigate(result)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm ${
                  i === activeIndex ? "bg-primary/5" : "hover:bg-gray-50"
                }`}
              >
                <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                  result.type === "case" ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                }`}>
                  {result.type === "case" ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${i === activeIndex ? "text-primary" : "text-gray-900"}`}>
                      {result.title}
                    </span>
                    {result.isUrgent && (
                      <span className="text-xs px-1 py-0.5 bg-red-100 text-red-700 rounded">Urgente</span>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      result.type === "case"
                        ? (CASE_STATUS_COLORS[result.status] || "bg-gray-100 text-gray-600")
                        : (TASK_STATUS_COLORS[result.status] || "bg-gray-100 text-gray-600")
                    }`}>
                      {result.status}
                    </span>
                  </div>
                  {result.subtitle && (
                    <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                  )}
                </div>
                <svg className={`w-4 h-4 shrink-0 ${i === activeIndex ? "text-primary" : "text-gray-300"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        )}

        {query.length < 2 && (
          <div className="px-4 py-6 text-center text-xs text-gray-400">
            Escribe al menos 2 caracteres para buscar
          </div>
        )}
      </div>
    </div>
  );
}
