"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Message = { id: string; role: "user" | "assistant"; content: string };

function newMessage(role: Message["role"], content: string): Message {
  return { id: crypto.randomUUID(), role, content };
}

const SUGGESTIONS = [
  "How do I upload a packing list?",
  "What does each document status mean?",
  "How does HS code grouping work?",
];

export function DashboardAssistantChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hiddenOnDocumentDetail = /^\/dashboard\/documents\/[^/]+$/.test(
    pathname ?? "",
  );

  useEffect(() => {
    if (messages.length === 0 && !loading) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (hiddenOnDocumentDetail) {
    return null;
  }

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, newMessage("user", text)]);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/dashboard/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages,
        }),
      });
      const data = (await res.json()) as { content?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to get response");
      }
      setMessages((m) => [...m, newMessage("assistant", data.content ?? "")]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      setMessages((m) => [
        ...m,
        newMessage(
          "assistant",
          "Sorry, I couldn't answer that. Check that OPENROUTER_API_KEY is set and try again.",
        ),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (open) setExpanded(false);
        }}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#007bff] text-white shadow-lg hover:bg-[#0069d9] transition-colors font-medium text-sm"
        aria-expanded={open}
        aria-label={open ? "Close assistant" : "Open AI assistant"}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
        {open ? "Close" : "AI Assistant"}
      </button>

      {open && (
        <div
          className={`fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl transition-[width,height,inset] ${
            expanded
              ? "inset-4 md:inset-8 max-w-none h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)]"
              : "bottom-24 right-6 w-full max-w-md"
          }`}
          style={expanded ? undefined : { maxHeight: "min(72vh, 560px)" }}
          role="dialog"
          aria-modal="true"
          aria-label="AI Assistant"
        >
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#007bff]/10 flex items-center justify-center text-[#007bff] shrink-0">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">
                  Impact Assistant
                </p>
                <p className="text-xs text-gray-500 truncate">
                  HS codes · uploads · workflow
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors shrink-0"
              aria-label={expanded ? "Minimize" : "Expand"}
            >
              {expanded ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 leading-relaxed">
                  Hi — I can help with uploads, HS grouping, customs prep, and
                  using this dashboard. Ask anything.
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      disabled={loading}
                      className="text-left text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-gray-700 hover:border-[#007bff]/40 hover:bg-blue-50 hover:text-[#007bff] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-[#007bff] text-white"
                      : "bg-gray-50 text-gray-900 border border-gray-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-xl px-3 py-2 bg-gray-50 border border-gray-100 text-sm text-gray-500">
                  <span className="inline-flex gap-1">
                    <span className="animate-pulse">Thinking</span>
                    <span className="animate-pulse">…</span>
                  </span>
                </div>
              </div>
            )}
            {error && (
              <p className="text-xs text-red-700 bg-red-50 px-2 py-1 rounded-lg border border-red-100">
                {error}
              </p>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-gray-100 bg-gray-50/50 shrink-0">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about uploads, HS codes, your documents…"
                rows={2}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#007bff]/30 focus:border-[#007bff] outline-none"
                disabled={loading}
                aria-label="Message"
              />
              <button
                type="button"
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="shrink-0 px-4 py-2 rounded-xl bg-[#007bff] text-white font-medium text-sm hover:bg-[#0069d9] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
