import React, { useEffect, useRef, KeyboardEvent } from "react";

interface MessageSearchProps {
  isOpen: boolean;
  onClose: () => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  matchCount: number;
  currentMatch: number; // 1-based; 0 when no matches
  onPrevMatch: () => void;
  onNextMatch: () => void;
}

export default function MessageSearch({
  isOpen,
  onClose,
  searchTerm,
  onSearchChange,
  matchCount,
  currentMatch,
  onPrevMatch,
  onNextMatch,
}: MessageSearchProps): JSX.Element | null {
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus input whenever the bar opens
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  const navDisabled = matchCount < 2;

  const counterText =
    matchCount === 0
      ? "No results"
      : `${currentMatch} of ${matchCount}`;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="message-search-bar"
      role="search"
      aria-label="Search messages"
      onKeyDown={handleKeyDown}
    >
      <input
        ref={inputRef}
        className="message-search-input"
        type="text"
        placeholder="Search messages…"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label="Search messages input"
      />

      <span className="search-counter" aria-live="polite" aria-atomic="true">
        {counterText}
      </span>

      <button
        className="search-nav-btn"
        onClick={onPrevMatch}
        disabled={navDisabled}
        aria-label="Previous match"
        title="Previous match"
      >
        ↑
      </button>

      <button
        className="search-nav-btn"
        onClick={onNextMatch}
        disabled={navDisabled}
        aria-label="Next match"
        title="Next match"
      >
        ↓
      </button>

      <button
        className="search-close-btn"
        onClick={onClose}
        aria-label="Close search"
        title="Close search"
      >
        ✕
      </button>
    </div>
  );
}
