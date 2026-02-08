"use client";

import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };

export function DocumentChat({ documentId }: { documentId: string }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to get response");
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.content ?? "" },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Sorry, I couldn’t answer that. Please try again.",
        },
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
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (open) setExpanded(false);
        }}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--dark-bg)] text-[var(--dark-foreground)] shadow-lg hover:bg-[var(--dark-bg-elevated)] transition-colors font-medium text-sm"
        aria-expanded={open}
        aria-label={open ? "Close chat" : "Ask AI"}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {open ? "Close" : "Ask AI"}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={`fixed z-50 flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background-card)] shadow-xl transition-[width,height,inset] ${
            expanded
              ? "inset-4 md:inset-8 max-w-none h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)]"
              : "bottom-24 right-6 w-full max-w-md"
          }`}
          style={expanded ? undefined : { maxHeight: "min(70vh, 520px)" }}
        >
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--background)]/50 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-light)] flex items-center justify-center text-[var(--accent)]">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <span className="font-semibold text-[var(--foreground)] text-sm">
                Ask AI
              </span>
            </div>
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="p-2 rounded-lg text-[var(--foreground)]/60 hover:text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
              aria-label={expanded ? "Minimize" : "Expand to full window"}
              title={expanded ? "Minimize" : "Expand"}
            >
              {expanded ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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
              <p className="text-sm text-[var(--foreground)]/60">
                Ask anything about the detected items and HS code groups.
                <br />
                <span className="text-xs mt-1 block">
                  e.g. &quot;Which items are under 9405?&quot;, &quot;What needs
                  more description?&quot;
                </span>
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--background)] text-[var(--foreground)] border border-[var(--border)]"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-lg px-3 py-2 bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)]/70">
                  <span className="inline-flex gap-1">
                    <span className="animate-pulse">Thinking</span>
                    <span className="animate-pulse">...</span>
                  </span>
                </div>
              </div>
            )}
            {error && (
              <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                {error}
              </p>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-[var(--border)] bg-[var(--background)]/30">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about items, HS codes, quantities…"
                rows={2}
                className="flex-1 resize-none rounded-lg border border-[var(--border)] px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] outline-none"
                disabled={loading}
                aria-label="Message"
              />
              <button
                type="button"
                onClick={send}
                disabled={!input.trim() || loading}
                className="shrink-0 px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-medium text-sm hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
