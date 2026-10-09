import { useState, useEffect, useRef, useCallback } from "react";
import React from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import type { ChatMessage as ChatMessageType } from "../lib/agent";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessageProps {
  message: ChatMessageType & { isEdited?: boolean; editedAt?: Date };
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  isStreaming?: boolean;
  searchTerm?: string;
}

// ─── Search highlight helper ──────────────────────────────────────────────────

function highlightText(text: string, term: string): React.ReactNode {
  if (!term.trim()) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === term.toLowerCase() ? (
      <mark key={i} className="search-match">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

// ─── Timestamp helpers ────────────────────────────────────────────────────────

function formatShortTimestamp(date: Date): string {
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) {
    return timeStr;
  }

  const dateStr = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
  return `${dateStr}, ${timeStr}`;
}

function formatFullTimestamp(date: Date): string {
  return (
    date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) +
    " at " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

// ─── Copy hook — shared by message copy and code copy ────────────────────────

function useCopyToClipboard(ms = 1500) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), ms);
      } catch {
        // clipboard access denied — fail silently
      }
    },
    [ms]
  );

  return { copied, copy };
}

// ─── CodeBlock component — used as react-markdown renderer ───────────────────

interface CodeBlockProps {
  language: string;
  value: string;
}

function CodeBlock({ language, value }: CodeBlockProps) {
  const codeRef = useRef<HTMLElement>(null);
  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    if (!codeRef.current) return;

    // Dynamically import highlight.js to avoid SSR issues
    import("highlight.js/lib/core").then(({ default: hljs }) => {
      // Register only the languages we care about
      const supportedLanguages: Record<
        string,
        () => Promise<{ default: object }>
      > = {
        python: () => import("highlight.js/lib/languages/python"),
        javascript: () => import("highlight.js/lib/languages/javascript"),
        typescript: () => import("highlight.js/lib/languages/typescript"),
        bash: () => import("highlight.js/lib/languages/bash"),
        json: () => import("highlight.js/lib/languages/json"),
        sql: () => import("highlight.js/lib/languages/sql"),
      };

      const lang = language.toLowerCase();
      if (lang && supportedLanguages[lang]) {
        supportedLanguages[lang]().then(({ default: langDef }) => {
          try {
            hljs.registerLanguage(
              lang,
              langDef as Parameters<typeof hljs.registerLanguage>[1]
            );
          } catch {
            // already registered — ignore
          }
          if (codeRef.current) {
            hljs.highlightElement(codeRef.current);
          }
        });
      }
    });
  }, [language, value]);

  const displayLang = language || "plaintext";

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-lang-label">{displayLang}</span>
        <button
          className="code-copy-btn"
          onClick={() => copy(value)}
          aria-label="Copy code to clipboard"
        >
          {copied ? "Copied!" : "📋 Copy"}
        </button>
      </div>
      <pre>
        <code ref={codeRef} className={language ? `language-${language}` : ""}>
          {value}
        </code>
      </pre>
    </div>
  );
}

// ─── Custom react-markdown components ─────────────────────────────────────────

const markdownComponents: Components = {
  // Code blocks (fenced) and inline code
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className ?? "");
    const isBlock = "node" in props ? false : !!match;
    void isBlock; // suppress unused warning

    if (match) {
      return (
        <CodeBlock
          language={match[1]}
          value={String(children).replace(/\n$/, "")}
        />
      );
    }

    return (
      <code className="inline-code" {...props}>
        {children}
      </code>
    );
  },

  // Suppress the wrapping <pre> since CodeBlock renders its own
  pre({ children }) {
    return <>{children}</>;
  },
};

// ─── Main ChatMessage component ───────────────────────────────────────────────

// React.memo prevents re-renders when parent re-renders but this message's
// props haven't changed — important for conversations with many messages.
// Full react-window virtualization is deferred: it would break scroll-to-match
// for in-conversation search (Cmd+F) and adds complexity beyond POC scope.
function ChatMessage({
  message,
  onEdit,
  onDelete,
  onEditStart,
  onEditEnd,
  isStreaming = false,
  searchTerm = "",
}: ChatMessageProps) {
  const isUser = message.role === "user";

  // ── Edit state ────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep editValue in sync if message content changes externally (e.g., streaming)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(message.content);
    }
  }, [message.content, isEditing]);

  // Focus textarea when edit mode opens
  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus();
      // Place cursor at end
      const len = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const startEdit = useCallback(() => {
    if (isStreaming) return;
    setEditValue(message.content);
    setIsEditing(true);
    onEditStart?.();
  }, [isStreaming, message.content, onEditStart]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue(message.content);
    onEditEnd?.();
  }, [message.content, onEditEnd]);

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === message.content) {
      cancelEdit();
      return;
    }
    onEdit?.(message.id, trimmed);
    setIsEditing(false);
    onEditEnd?.();
  }, [editValue, message.content, message.id, onEdit, cancelEdit, onEditEnd]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        commitEdit();
      }
      if (e.key === "Escape") {
        cancelEdit();
      }
    },
    [commitEdit, cancelEdit]
  );

  // ── Delete ────────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (isStreaming) return;
    onDelete?.(message.id);
  }, [isStreaming, message.id, onDelete]);

  // ── Message copy (copies plain text) ─────────────────────────────
  const { copied: msgCopied, copy: copyMsg } = useCopyToClipboard();

  const handleCopy = useCallback(() => {
    copyMsg(message.content);
  }, [message.content, copyMsg]);

  // ── Timestamp ─────────────────────────────────────────────────────
  const shortTime = formatShortTimestamp(message.timestamp);
  const fullTime = formatFullTimestamp(message.timestamp);

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div
      id={`msg-${message.id}`}
      className={`message ${isUser ? "user" : "assistant"}`}
    >
      <div className="message-bubble">
        {/* ── Action buttons (shown on hover via CSS) ── */}
        {!isEditing && (
          <div
            className="message-actions"
            role="group"
            aria-label="Message actions"
          >
            {/* Copy button — all messages */}
            <button
              className="msg-action-btn"
              onClick={handleCopy}
              aria-label="Copy message"
              title="Copy message"
              disabled={isStreaming}
            >
              {msgCopied ? "✓" : "📋"}
            </button>

            {/* Edit button — user messages only */}
            {isUser && onEdit && (
              <button
                className="msg-action-btn"
                onClick={startEdit}
                aria-label="Edit message"
                title="Edit message"
                disabled={isStreaming}
              >
                ✏️
              </button>
            )}

            {/* Delete button — all messages */}
            {onDelete && (
              <button
                className="msg-action-btn"
                onClick={handleDelete}
                aria-label="Delete message"
                title="Delete message"
                disabled={isStreaming}
              >
                🗑
              </button>
            )}
          </div>
        )}

        {/* ── Message content ── */}
        {isEditing ? (
          /* Edit mode */
          <div>
            <textarea
              ref={textareaRef}
              className="message-edit-textarea"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleEditKeyDown}
              aria-label="Edit message content"
            />
            <div className="message-edit-actions">
              <button
                className="edit-cancel-btn"
                onClick={cancelEdit}
                aria-label="Cancel edit"
              >
                Cancel
              </button>
              <button
                className="edit-save-btn"
                onClick={commitEdit}
                aria-label="Save edit"
              >
                Save
              </button>
            </div>
          </div>
        ) : isUser ? (
          /* User message — plain text with optional search highlight */
          <p style={{ whiteSpace: "pre-wrap" }}>
            {searchTerm
              ? highlightText(message.content, searchTerm)
              : message.content}
          </p>
        ) : (
          /* Assistant message — rendered markdown */
          <ReactMarkdown components={markdownComponents}>
            {message.content || ""}
          </ReactMarkdown>
        )}

        {/* ── Timestamp + edited badge ── */}
        <p className="message-time" title={fullTime}>
          {shortTime}
          {message.isEdited && (
            <span className="message-edited-badge">(edited)</span>
          )}
        </p>
      </div>
    </div>
  );
}
export default React.memo(ChatMessage);
