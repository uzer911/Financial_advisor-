/**
 * localStorage utilities for persisting conversation data, drafts, and preferences
 * Handles JSON serialization, quota management, and fallback behavior
 */

import { Conversation, Message } from "@/types";

// Storage keys
const STORAGE_KEYS = {
  conversations: "conversations",
  drafts: "drafts",
  theme: "theme",
  shortcuts: "shortcuts",
} as const;

/**
 * Check if localStorage is available
 * (handles private browsing mode where it might be unavailable)
 */
function isLocalStorageAvailable(): boolean {
  try {
    const test = "__storage_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all conversations from localStorage
 * @returns Array of conversations or empty array if none exist
 */
export function getConversations(): Conversation[] {
  if (!isLocalStorageAvailable()) {
    console.warn("localStorage unavailable, returning empty conversations");
    return [];
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.conversations);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    // Ensure dates are properly converted
    return (parsed as Conversation[]).map((conv) => ({
      ...conv,
      createdAt: new Date(conv.createdAt),
      updatedAt: new Date(conv.updatedAt),
      messages: conv.messages.map((msg) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
        editedAt: msg.editedAt ? new Date(msg.editedAt) : undefined,
      })),
    }));
  } catch (error) {
    console.error("Error parsing conversations from localStorage:", error);
    return [];
  }
}

/**
 * Save conversations to localStorage
 * @param conversations Array of conversations to persist
 */
export function setConversations(conversations: Conversation[]): void {
  if (!isLocalStorageAvailable()) {
    console.warn("localStorage unavailable, cannot save conversations");
    return;
  }

  try {
    const serialized = JSON.stringify(conversations);
    localStorage.setItem(STORAGE_KEYS.conversations, serialized);
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.code === DOMException.QUOTA_EXCEEDED_ERR
    ) {
      console.warn("localStorage quota exceeded, cannot save conversations");
      // Could implement cleanup of old conversations here
    } else {
      console.error("Error saving conversations to localStorage:", error);
    }
  }
}

/**
 * Get draft messages from localStorage
 * @returns Record of conversation IDs to draft text
 */
export function getDrafts(): Record<string, string> {
  if (!isLocalStorageAvailable()) {
    return {};
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.drafts);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch (error) {
    console.error("Error parsing drafts from localStorage:", error);
    return {};
  }
}

/**
 * Save draft messages to localStorage
 * @param drafts Record of conversation IDs to draft text
 */
export function setDrafts(drafts: Record<string, string>): void {
  if (!isLocalStorageAvailable()) {
    console.warn("localStorage unavailable, cannot save drafts");
    return;
  }

  try {
    const serialized = JSON.stringify(drafts);
    localStorage.setItem(STORAGE_KEYS.drafts, serialized);
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.code === DOMException.QUOTA_EXCEEDED_ERR
    ) {
      console.warn("localStorage quota exceeded, cannot save drafts");
    } else {
      console.error("Error saving drafts to localStorage:", error);
    }
  }
}

/**
 * Get theme preference from localStorage
 * @returns Current theme preference or null if not set
 */
export function getTheme(): "light" | "dark" | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.theme);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
    return null;
  } catch (error) {
    console.error("Error getting theme from localStorage:", error);
    return null;
  }
}

/**
 * Save theme preference to localStorage
 * @param theme Theme to persist: "light" or "dark"
 */
export function setTheme(theme: "light" | "dark"): void {
  if (!isLocalStorageAvailable()) {
    console.warn("localStorage unavailable, cannot save theme");
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  } catch (error) {
    console.error("Error saving theme to localStorage:", error);
  }
}

/**
 * Check localStorage quota usage
 * @returns Object with available flag and percentUsed (0-100)
 */
export function checkStorageQuota(): { available: boolean; percentUsed: number } {
  if (!isLocalStorageAvailable()) {
    return { available: false, percentUsed: 100 };
  }

  try {
    // Estimate based on total data size
    let totalSize = 0;

    for (const key of Object.values(STORAGE_KEYS)) {
      const item = localStorage.getItem(key);
      if (item) {
        totalSize += item.length;
      }
    }

    // Most browsers have 5-10MB per origin
    // Use conservative estimate of 5MB
    const maxSize = 5 * 1024 * 1024;
    const percentUsed = Math.round((totalSize / maxSize) * 100);

    // Consider storage "full" if over 90%
    const available = percentUsed < 90;

    return { available, percentUsed: Math.min(percentUsed, 100) };
  } catch (error) {
    console.error("Error checking storage quota:", error);
    return { available: true, percentUsed: 0 };
  }
}

/**
 * Clear old conversations from storage (optional cleanup)
 * @param maxDays Maximum age of conversations to keep
 */
export function clearExpiredData(maxDays: number = 90): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    const conversations = getConversations();
    const now = new Date();
    const maxAge = maxDays * 24 * 60 * 60 * 1000;

    const filtered = conversations.filter((conv) => {
      const age = now.getTime() - conv.updatedAt.getTime();
      return age < maxAge;
    });

    if (filtered.length < conversations.length) {
      setConversations(filtered);
      console.log(
        `Cleared ${conversations.length - filtered.length} expired conversations`
      );
    }
  } catch (error) {
    console.error("Error clearing expired data:", error);
  }
}

/**
 * Clear all storage (useful for logout or debugging)
 */
export function clearAllStorage(): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    for (const key of Object.values(STORAGE_KEYS)) {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.error("Error clearing storage:", error);
  }
}
