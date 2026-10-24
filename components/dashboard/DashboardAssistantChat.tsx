"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Message = { id: string; role: "user" | "assistant"; content: string };

function newMessage(role: Message["role"], content: string): Message {
  return { id: crypto.randomUUID(), role, content };
}

const DEFAULT_SUGGESTIONS = [
  "How do I upload a packing list?",
  "What does each document status mean?",
  "How does HS code grouping work?",
];

const IMPORT_CASE_SUGGESTIONS = [
  "What should I do on this step?",
  "What is blocking me from continuing?",
  "Explain the import case workflow steps",
];

const IMPORT_CASE_HINT_STORAGE_KEY =
  "impact-assistant-import-case-hint-dismissed";

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
      aria-label={label}
    >
      {children}
    </button>
  );
}

function AssistantMark() {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-[11px] font-bold tracking-tight text-white shadow-sm"
      aria-hidden
    >
      IL
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

export function DashboardAssistantChat() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onImportCase =
    /^\/dashboard\/import-cases\/[^/]+$/.test(pathname ?? "") &&
    !pathname?.includes("/new");
  const wizardStepId = searchParams.get("step");
  const suggestions = onImportCase ? IMPORT_CASE_SUGGESTIONS : DEFAULT_SUGGESTIONS;
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStepHint, setShowStepHint] = useState(false);
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

  const dismissStepHint = () => {
    setShowStepHint(false);
    try {
      localStorage.setItem(IMPORT_CASE_HINT_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!onImportCase) {
      setShowStepHint(false);
      return;
    }

    let dismissed = false;
    try {
      dismissed = localStorage.getItem(IMPORT_CASE_HINT_STORAGE_KEY) === "1";
    } catch {
      dismissed = false;
    }

    setShowStepHint(!dismissed);
  }, [onImportCase, pathname]);

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
          page: {
            pathname: pathname ?? "",
            wizardStepId,
          },
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

  const openAssistant = () => {
    dismissStepHint();
    setOpen(true);
    setExpanded(false);
  };

  const closeAssistant = () => {
    setOpen(false);
    setExpanded(false);
  };

  const toggleAssistant = () => {
    if (open) {
      closeAssistant();
      return;
    }
    dismissStepHint();
    setOpen(true);
    setExpanded(false);
  };

  const contextLine = onImportCase
    ? "Step-aware · this import case"
    : "Uploads · HS codes · workflow";

  return (
    <>
      <div className="dashboard-assistant-fab-wrap">
        {showStepHint && onImportCase && !open && (
          <div
            className="dashboard-assistant-hint"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <div
                className="shrink-0 w-9 h-9 rounded-xl bg-[#007bff]/10 text-[#007bff] flex items-center justify-center"
                aria-hidden="true"
              >
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
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 leading-snug">
                  Ask AI about this step
                </p>
                <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                  The assistant sees your current wizard tab and case progress.
                  Ask for guidance, blockers, or what to do next on any step.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={openAssistant}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#007bff] text-white hover:bg-[#0069d9] transition-colors"
                  >
                    Open assistant
                  </button>
                  <button
                    type="button"
                    onClick={dismissStepHint}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={toggleAssistant}
          className={`dashboard-assistant-fab ${open ? "dashboard-assistant-fab--open" : ""}`}
          aria-expanded={open}
          aria-label={open ? "Close assistant" : "Open AI assistant"}
        >
          <svg
            className="w-5 h-5 shrink-0"
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
          <span>{open ? "Close" : "AI Assistant"}</span>
        </button>
      </div>

      {open && (
        <div
          className={`dashboard-assistant-panel ${
            expanded ? "dashboard-assistant-panel--expanded" : ""
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Impact Assistant"
        >
          <header className="dashboard-assistant-header">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#007bff] to-[#0069d9] text-white shadow-md shadow-blue-500/20">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.75}
                      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
                    />
                  </svg>
                </div>
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500"
                  title="Available"
                />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-slate-900">
                  Impact Assistant
                </h2>
                <p className="truncate text-xs text-slate-500">{contextLine}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <IconButton
                label={expanded ? "Restore panel size" : "Expand panel"}
                onClick={() => setExpanded((e) => !e)}
              >
                {expanded ? (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                )}
              </IconButton>
              <IconButton label="Close assistant" onClick={closeAssistant}>
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </IconButton>
            </div>
          </header>

          <div className="dashboard-assistant-messages">
            {messages.length === 0 && (
              <div className="dashboard-assistant-welcome">
                <p className="text-sm font-medium text-slate-800">
                  How can I help?
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {onImportCase
                    ? "I can explain this wizard step, what’s blocking progress, and what to do next."
                    : "I can help with document uploads, HS classification workflow, and using this dashboard."}
                </p>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Suggested questions
                </p>
                <ul className="mt-2 space-y-2">
                  {suggestions.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => send(s)}
                        disabled={loading}
                        className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-left text-xs font-medium leading-snug text-slate-700 shadow-sm transition-colors hover:border-[#007bff]/35 hover:bg-blue-50/50 hover:text-[#007bff] disabled:opacity-50"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {messages.map((msg) =>
              msg.role === "user" ? (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[88%] rounded-2xl rounded-tr-md bg-[#007bff] px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-sm shadow-blue-500/15">
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex gap-2.5">
                  <AssistantMark />
                  <div className="min-w-0 max-w-[calc(100%-2.75rem)] rounded-2xl rounded-tl-md border border-slate-200/80 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm">
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ),
            )}
            {loading && (
              <div className="flex gap-2.5">
                <AssistantMark />
                <div className="rounded-2xl rounded-tl-md border border-slate-200/80 bg-slate-50 px-3.5 py-3 text-sm text-slate-500">
                  <span className="sr-only">Assistant is thinking</span>
                  <ThinkingDots />
                </div>
              </div>
            )}
            {error && (
              <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}
            <div ref={messagesEndRef} />
          </div>

          <footer className="dashboard-assistant-composer">
            <div className="dashboard-assistant-composer-inner">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  onImportCase
                    ? "Ask about this step or what to do next…"
                    : "Message Impact Assistant…"
                }
                rows={2}
                className="dashboard-assistant-input"
                disabled={loading}
                aria-label="Message"
              />
              <button
                type="button"
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="dashboard-assistant-send"
                aria-label="Send message"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 12h14m-7-7l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-400">
              AI guidance only — verify HS codes and declarations with your
              compliance team.
            </p>
          </footer>
        </div>
      )}
    </>
  );
}
