/**
 * ConversationItem — a single row in the sidebar conversation list.
 *
 * Tasks 5, 7, 8, 9:
 *  - Pin badge, truncated title, metadata line
 *  - Hover action buttons (rename, delete, export, pin, share)
 *  - Inline title editing (Task 7)
 *  - Delete confirmation dialog (Task 8)
 *  - Pin / unpin (Task 9)
 */

import React, { useState, useRef, useEffect } from "react";
import { Conversation } from "../types";
import ConfirmDialog from "./ConfirmDialog";

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  searchTerm: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onPin: (id: string) => void;
  onExport: (id: string, format: "pdf" | "markdown" | "csv") => void;
}

/** Format a date into a human-readable relative label */
function formatRelativeDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === yesterday.getTime()) return "Yesterday";

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Highlight a matching substring inside a title */
function HighlightedTitle({
  title,
  searchTerm,
}: {
  title: string;
  searchTerm: string;
}) {
  const truncated = title.length > 50 ? title.slice(0, 50) + "…" : title;

  if (!searchTerm.trim()) {
    return <span className="item-title">{truncated}</span>;
  }

  const lower = truncated.toLowerCase();
  const termLower = searchTerm.toLowerCase();
  const idx = lower.indexOf(termLower);

  if (idx === -1) {
    return <span className="item-title">{truncated}</span>;
  }

  return (
    <span className="item-title">
      {truncated.slice(0, idx)}
      <mark className="search-highlight">
        {truncated.slice(idx, idx + searchTerm.length)}
      </mark>
      {truncated.slice(idx + searchTerm.length)}
    </span>
  );
}

export default function ConversationItem({
  conversation,
  isActive,
  searchTerm,
  onSelect,
  onDelete,
  onRename,
  onPin,
  onExport,
}: ConversationItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(conversation.title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExportMenu]);

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== conversation.title) {
      onRename(conversation.id, trimmed);
    } else {
      setEditValue(conversation.title);
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setEditValue(conversation.title);
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}?conv=${conversation.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for environments without clipboard API
    }
    setToastMsg("Link copied!");
    setTimeout(() => setToastMsg(null), 2000);
  };

  const msgCount = conversation.messages.length;

  return (
    <>
      <div
        className={`conversation-item${isActive ? " active" : ""}`}
        onClick={() => {
          if (!isEditing) onSelect(conversation.id);
        }}
        role="button"
        tabIndex={0}
        aria-label={`Conversation: ${conversation.title}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!isEditing) onSelect(conversation.id);
          }
        }}
      >
        {/* Pin icon */}
        {conversation.isPinned && (
          <span className="pin-icon" aria-label="Pinned">
            📌
          </span>
        )}

        {/* Title — edit mode or display mode */}
        <div className="item-body">
          {isEditing ? (
            <input
              ref={inputRef}
              className="item-edit-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleEditKeyDown}
              onBlur={commitEdit}
              onClick={(e) => e.stopPropagation()}
              aria-label="Edit conversation title"
            />
          ) : (
            <HighlightedTitle
              title={conversation.title}
              searchTerm={searchTerm}
            />
          )}

          <div className="item-meta">
            <span>{formatRelativeDate(conversation.updatedAt)}</span>
            <span className="item-meta-sep">·</span>
            <span>{msgCount} {msgCount === 1 ? "msg" : "msgs"}</span>
          </div>
        </div>

        {/* Hover action buttons */}
        <div className="item-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="action-btn"
            aria-label="Rename conversation"
            title="Rename"
            onClick={(e) => {
              e.stopPropagation();
              setEditValue(conversation.title);
              setIsEditing(true);
            }}
          >
            ✏️
          </button>

          <button
            className="action-btn"
            aria-label="Delete conversation"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteDialog(true);
            }}
          >
            🗑
          </button>

          <div className="export-wrapper" ref={exportMenuRef}>
            <button
              className="action-btn"
              aria-label="Export conversation"
              title="Export"
              onClick={(e) => {
                e.stopPropagation();
                setShowExportMenu((v) => !v);
              }}
            >
              📤
            </button>
            {showExportMenu && (
              <div className="export-menu" role="menu">
                {(["pdf", "markdown", "csv"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    role="menuitem"
                    className="export-menu-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExport(conversation.id, fmt);
                      setShowExportMenu(false);
                    }}
                    aria-label={`Export as ${fmt.toUpperCase()}`}
                  >
                    {fmt === "pdf" ? "PDF" : fmt === "markdown" ? "Markdown" : "CSV"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className="action-btn"
            aria-label={
              conversation.isPinned ? "Unpin conversation" : "Pin conversation"
            }
            title={conversation.isPinned ? "Unpin" : "Pin"}
            onClick={(e) => {
              e.stopPropagation();
              onPin(conversation.id);
            }}
          >
            {conversation.isPinned ? "📍" : "📌"}
          </button>

          <button
            className="action-btn"
            aria-label="Share conversation link"
            title="Share"
            onClick={(e) => {
              e.stopPropagation();
              handleShare();
            }}
          >
            🔗
          </button>
        </div>

        {/* Toast notification */}
        {toastMsg && (
          <div className="item-toast" role="status" aria-live="polite">
            {toastMsg}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Delete conversation?"
        message="Delete this conversation? This cannot be undone."
        onConfirm={() => {
          setShowDeleteDialog(false);
          onDelete(conversation.id);
        }}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </>
  );
}
