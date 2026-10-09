/**
 * useDrafts Hook
 * 
 * Manages auto-save of message drafts to localStorage.
 * Automatically saves draft every 2 seconds.
 * Provides methods to get, set, and clear drafts.
 * 
 * Validates: Requirements 30.1, 30.2, 30.3, 30.4
 */

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "drafts";
const AUTO_SAVE_INTERVAL = 2000; // 2 seconds

/**
 * Hook for managing message drafts with auto-save to localStorage
 */
export function useDrafts() {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  /**
   * Load drafts from localStorage on mount
   */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setDrafts(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Failed to load drafts from localStorage:", error);
    }
  }, []);

  /**
   * Auto-save drafts to localStorage every 2 seconds
   */
  useEffect(() => {
    const timer = setInterval(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
      } catch (error) {
        console.error("Failed to save drafts to localStorage:", error);
      }
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(timer);
  }, [drafts]);

  /**
   * Set or update a draft for a conversation
   */
  const setDraft = useCallback((conversationId: string, text: string) => {
    setDrafts((prev) => ({
      ...prev,
      [conversationId]: text,
    }));
  }, []);

  /**
   * Get the draft for a specific conversation
   */
  const getDraft = useCallback(
    (conversationId: string): string => {
      return drafts[conversationId] || "";
    },
    [drafts]
  );

  /**
   * Clear the draft for a specific conversation
   */
  const clearDraft = useCallback((conversationId: string) => {
    setDrafts((prev) => {
      const updated = { ...prev };
      delete updated[conversationId];
      return updated;
    });
  }, []);

  return {
    drafts,
    setDraft,
    getDraft,
    clearDraft,
  };
}
