/**
 * useKeyboardShortcuts Hook
 * 
 * Sets up global keyboard event listeners for registered shortcuts.
 * Handles: Cmd+K, Cmd+/, Cmd+N, Cmd+F, Escape, Enter, Shift+Enter
 * Disables shortcuts on mobile/touch devices.
 * 
 * Validates: Requirements 17.1, 17.5, 17.6
 */

import { useEffect } from "react";

export interface ShortcutHandler {
  key: string; // Key combination identifier (e.g., "cmd-k")
  action: () => void; // Callback when shortcut is triggered
  description: string; // Human-readable description
}

/**
 * Detect if device is touch-enabled (mobile)
 */
function isTouchDevice(): boolean {
  return (
    typeof window !== "undefined" &&
    (navigator.maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0 ||
      window.matchMedia("(pointer:coarse)").matches)
  );
}

/**
 * Hook for registering and listening to global keyboard shortcuts
 * @param shortcuts - Array of shortcut handlers
 */
export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]) {
  useEffect(() => {
    // Disable shortcuts on mobile/touch devices
    if (isTouchDevice()) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      const modKey = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const shiftKey = event.shiftKey;

      // Build shortcut key identifier
      let shortcutKey = "";

      if (modKey && key === "k") {
        shortcutKey = "cmd-k";
      } else if (modKey && key === "/") {
        shortcutKey = "cmd-slash";
      } else if (modKey && key === "n") {
        shortcutKey = "cmd-n";
      } else if (modKey && key === "f") {
        shortcutKey = "cmd-f";
      } else if (key === "escape") {
        shortcutKey = "escape";
      } else if (key === "enter" && shiftKey) {
        shortcutKey = "shift-enter";
      } else if (key === "enter") {
        shortcutKey = "enter";
      }

      // Find and execute matching shortcut
      if (shortcutKey) {
        const handler = shortcuts.find((s) => s.key === shortcutKey);
        if (handler) {
          event.preventDefault();
          handler.action();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [shortcuts]);
}

/**
 * Hook for predefined shortcuts (for convenience)
 * Use this if you want to set up common shortcuts globally
 */
export function useGlobalShortcuts(handlers: {
  onCmdK?: () => void;
  onCmdSlash?: () => void;
  onCmdN?: () => void;
  onCmdF?: () => void;
  onEscape?: () => void;
  onEnter?: () => void;
  onShiftEnter?: () => void;
}) {
  const shortcuts: ShortcutHandler[] = [];

  if (handlers.onCmdK) {
    shortcuts.push({
      key: "cmd-k",
      action: handlers.onCmdK,
      description: "Open command palette",
    });
  }

  if (handlers.onCmdSlash) {
    shortcuts.push({
      key: "cmd-slash",
      action: handlers.onCmdSlash,
      description: "Show help/shortcuts",
    });
  }

  if (handlers.onCmdN) {
    shortcuts.push({
      key: "cmd-n",
      action: handlers.onCmdN,
      description: "New conversation",
    });
  }

  if (handlers.onCmdF) {
    shortcuts.push({
      key: "cmd-f",
      action: handlers.onCmdF,
      description: "Search messages",
    });
  }

  if (handlers.onEscape) {
    shortcuts.push({
      key: "escape",
      action: handlers.onEscape,
      description: "Close modals",
    });
  }

  if (handlers.onEnter) {
    shortcuts.push({
      key: "enter",
      action: handlers.onEnter,
      description: "Send message",
    });
  }

  if (handlers.onShiftEnter) {
    shortcuts.push({
      key: "shift-enter",
      action: handlers.onShiftEnter,
      description: "New line",
    });
  }

  useKeyboardShortcuts(shortcuts);
}
