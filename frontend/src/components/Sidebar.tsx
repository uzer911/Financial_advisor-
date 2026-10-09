/**
 * Sidebar — conversation list panel.
 *
 * Tasks 4, 6, 10, 11:
 *  - 280 px desktop panel / fixed mobile overlay (Task 4 + 11)
 *  - SearchBar with 300 ms debounce + highlight (Task 6)
 *  - ConversationItem list (Tasks 5, 7, 8, 9)
 *  - Pagination — 20 per page (Task 10)
 */

import React, { useState, useEffect } from "react";
import { Conversation } from "../types";
import { useDebounce } from "../hooks/useDebounce";
import ConversationItem from "./ConversationItem";

const PAGE_SIZE = 20;

interface SidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onPin: (id: string) => void;
  onExport: (id: string, format: "pdf" | "markdown" | "csv") => void;
  isOpen: boolean; // mobile overlay open state
  onClose: () => void; // close mobile overlay
}

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelect,
  onNewChat,
  onDelete,
  onRename,
  onPin,
  onExport,
  isOpen,
  onClose,
}: SidebarProps) {
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(searchInput, 300);

  // Reset to page 1 whenever the search term changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Filter by debounced search term
  const filtered = debouncedSearch.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : conversations;

  // Pagination slice
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSelect = (id: string) => {
    onSelect(id);
    onClose(); // also closes sidebar on mobile
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar${isOpen ? " open" : ""}`} aria-label="Conversations">
        {/* Header */}
        <div className="sidebar-header">
          <span className="sidebar-title">Conversations</span>
          {/* Close button — only visible on mobile */}
          <button
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        {/* New Chat */}
        <button
          className="new-chat-btn"
          onClick={() => {
            onNewChat();
            onClose();
          }}
          aria-label="Start a new chat"
        >
          + New Chat
        </button>

        {/* Search bar */}
        <div className="search-bar">
          <input
            type="text"
            className="search-input"
            placeholder="Search conversations…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search conversations"
          />
          {searchInput && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchInput("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Conversation list */}
        <div className="conversation-list" role="list">
          {filtered.length === 0 && conversations.length === 0 && (
            <p className="sidebar-empty">No conversations yet</p>
          )}

          {filtered.length === 0 && conversations.length > 0 && (
            <p className="sidebar-empty">
              No results for &laquo;{debouncedSearch}&raquo;
            </p>
          )}

          {paginated.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === currentConversationId}
              searchTerm={debouncedSearch}
              onSelect={handleSelect}
              onDelete={onDelete}
              onRename={onRename}
              onPin={onPin}
              onExport={onExport}
            />
          ))}
        </div>

        {/* Pagination — only when there are multiple pages */}
        {totalPages > 1 && (
          <div className="pagination" role="navigation" aria-label="Conversation pages">
            <button
              className="page-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous page"
            >
              ← Prev
            </button>
            <span className="page-info" aria-live="polite">
              {page} / {totalPages}
            </span>
            <button
              className="page-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Next page"
            >
              Next →
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
