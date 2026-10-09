/**
 * useConversations Hook
 * 
 * Manages conversation CRUD operations and persistence to localStorage.
 * Provides methods to add, update, delete, and pin conversations.
 * 
 * Validates: Requirements 1.1, 2.5
 */

import { useState, useEffect, useCallback } from "react";
import { Conversation, Message } from "../types";

const STORAGE_KEY = "conversations";

/**
 * Hook for managing conversations with localStorage persistence
 */
export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);

  /**
   * Load conversations from localStorage on mount
   */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Conversation[];
        // Ensure dates are parsed as Date objects
        const withDates = parsed.map((conv) => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
          messages: conv.messages.map((msg) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
            editedAt: msg.editedAt ? new Date(msg.editedAt) : undefined,
          })),
        }));
        setConversations(withDates);
      }
    } catch (error) {
      console.error("Failed to load conversations from localStorage:", error);
    }
  }, []);

  /**
   * Persist conversations to localStorage whenever they change
   */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (error) {
      console.error(
        "Failed to persist conversations to localStorage:",
        error
      );
    }
  }, [conversations]);

  /**
   * Add a new conversation to the top of the list
   */
  const addConversation = useCallback((conversation: Conversation) => {
    setConversations((prev) => [conversation, ...prev]);
  }, []);

  /**
   * Update an existing conversation with a partial object
   */
  const updateConversation = useCallback(
    (id: string, updates: Partial<Conversation>) => {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === id ? { ...conv, ...updates, updatedAt: new Date() } : conv
        )
      );
    },
    []
  );

  /**
   * Update the last assistant message in a conversation (for streaming).
   * Uses a functional state update so it's safe to call inside closures.
   */
  const updateLastAssistantMessage = useCallback(
    (id: string, content: string) => {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== id) return conv;
          const msgs = [...conv.messages];
          const lastIdx = msgs.length - 1;
          if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
            msgs[lastIdx] = { ...msgs[lastIdx], content };
          }
          return { ...conv, messages: msgs, updatedAt: new Date() };
        })
      );
    },
    []
  );

  /**
   * Delete a conversation by ID
   */
  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((conv) => conv.id !== id));
    // If deleted conversation is current, clear current
    if (id === currentConversationId) {
      setCurrentConversationId(null);
    }
  }, [currentConversationId]);

  /**
   * Toggle pin status of a conversation
   */
  const pinConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const conv = prev.find((c) => c.id === id);
      if (!conv) return prev;

      const updated = { ...conv, isPinned: !conv.isPinned };
      const others = prev.filter((c) => c.id !== id);

      // Sort: pinned first, then by updatedAt descending
      if (updated.isPinned) {
        const pinnedConvs = others.filter((c) => c.isPinned);
        const unpinnedConvs = others.filter((c) => !c.isPinned);
        return [...pinnedConvs, updated, ...unpinnedConvs];
      } else {
        const pinnedConvs = others.filter((c) => c.isPinned);
        const unpinnedConvs = others.filter((c) => !c.isPinned);
        return [
          ...pinnedConvs,
          ...unpinnedConvs.sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
          ),
          updated,
        ];
      }
    });
  }, []);

  /**
   * Get the current active conversation
   */
  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  );

  return {
    conversations,
    currentConversation,
    currentConversationId,
    addConversation,
    updateConversation,
    updateLastAssistantMessage,
    deleteConversation,
    pinConversation,
    setCurrentConversationId,
  };
}
