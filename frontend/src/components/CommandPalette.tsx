import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  KeyboardEvent,
} from "react";
import { CommandPaletteItem } from "../types";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandPaletteItem[];
}

/**
 * Groups an array of commands by their `category` field, preserving
 * insertion order of first appearance.
 */
function groupByCategory(
  items: CommandPaletteItem[]
): [string, CommandPaletteItem[]][] {
  const map = new Map<string, CommandPaletteItem[]>();
  for (const item of items) {
    const bucket = map.get(item.category);
    if (bucket) {
      bucket.push(item);
    } else {
      map.set(item.category, [item]);
    }
  }
  return Array.from(map.entries());
}

export default function CommandPalette({
  isOpen,
  onClose,
  commands,
}: CommandPaletteProps): JSX.Element | null {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Flatten filtered commands for keyboard navigation
  const filtered: CommandPaletteItem[] = query.trim()
    ? commands.filter((c) =>
        c.title.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  const grouped = groupByCategory(filtered);

  // Reset state when palette opens / closes
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      // Defer focus so the element is guaranteed to be in the DOM
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Keep selectedIndex in range when filtered list changes
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector<HTMLDivElement>(
      ".command-item.selected"
    );
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const executeCommand = useCallback(
    (cmd: CommandPaletteItem) => {
      cmd.action();
      onClose();
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            filtered.length === 0 ? 0 : (prev + 1) % filtered.length
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            filtered.length === 0
              ? 0
              : (prev - 1 + filtered.length) % filtered.length
          );
          break;
        case "Enter":
          e.preventDefault();
          if (filtered[selectedIndex]) {
            executeCommand(filtered[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "Tab": {
          // Trap focus within the palette
          const focusable = listRef.current
            ? Array.from(
                listRef.current.querySelectorAll<HTMLElement>(
                  "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
                )
              )
            : [];
          const all: HTMLElement[] = inputRef.current
            ? [inputRef.current, ...focusable]
            : focusable;
          if (all.length === 0) return;
          const first = all[0];
          const last = all[all.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
          break;
        }
        default:
          break;
      }
    },
    [filtered, selectedIndex, executeCommand, onClose]
  );

  if (!isOpen) return null;

  // Build a flat index counter across groups for selectedIndex comparison
  let globalIndex = 0;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="command-palette-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={handleKeyDown}
      >
        <input
          ref={inputRef}
          className="command-palette-input"
          type="text"
          placeholder="Type a command…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          aria-label="Search commands"
          aria-autocomplete="list"
          aria-controls="command-palette-list"
        />
        <div
          id="command-palette-list"
          ref={listRef}
          className="command-palette-list"
          role="listbox"
          aria-label="Command list"
        >
          {filtered.length === 0 && (
            <div
              style={{
                padding: "1.25rem 1rem",
                fontSize: "0.88rem",
                color: "var(--text-light)",
                textAlign: "center",
              }}
            >
              No commands found
            </div>
          )}
          {grouped.map(([category, items]) => (
            <div key={category}>
              <div
                className="command-category-label"
                aria-hidden="true"
              >
                {category}
              </div>
              {items.map((cmd) => {
                const isSelected = globalIndex === selectedIndex;
                const currentIndex = globalIndex;
                globalIndex += 1;
                return (
                  <div
                    key={cmd.id}
                    className={`command-item${isSelected ? " selected" : ""}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => executeCommand(cmd)}
                    onMouseEnter={() => setSelectedIndex(currentIndex)}
                    tabIndex={-1}
                  >
                    <span className="command-item-title">{cmd.title}</span>
                    {cmd.description && (
                      <span className="command-item-desc">
                        {cmd.description}
                      </span>
                    )}
                    {cmd.shortcut && (
                      <span className="command-item-shortcut">
                        {cmd.shortcut}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
