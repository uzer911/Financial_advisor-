import React, { useEffect, useRef, KeyboardEvent } from "react";

interface HelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutRow {
  key: string;
  description: string;
}

const SHORTCUTS: ShortcutRow[] = [
  { key: "Cmd+K", description: "Open command palette" },
  { key: "Cmd+/", description: "Show keyboard shortcuts" },
  { key: "Cmd+N", description: "New conversation" },
  { key: "Cmd+F", description: "Search in conversation" },
  { key: "Escape", description: "Close dialogs" },
  { key: "Enter", description: "Send message" },
  { key: "Shift+Enter", description: "New line in input" },
  { key: "Ctrl+Enter", description: "Save message edit" },
];

export default function HelpOverlay({
  isOpen,
  onClose,
}: HelpOverlayProps): JSX.Element | null {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Focus close button when overlay opens; restore focus on close
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => closeBtnRef.current?.focus());
    return () => {
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="help-overlay-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        className="help-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-overlay-title"
      >
        <div className="help-overlay-header">
          <h2 id="help-overlay-title">Keyboard Shortcuts</h2>
          <button
            ref={closeBtnRef}
            className="help-close-btn"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
          >
            ✕
          </button>
        </div>

        <table className="shortcuts-table" aria-label="Keyboard shortcuts">
          <tbody>
            {SHORTCUTS.map(({ key, description }) => (
              <tr key={key}>
                <td className="shortcut-key-cell">
                  <span className="shortcut-key-badge">{key}</span>
                </td>
                <td className="shortcut-desc">{description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
