/**
 * Unit tests for localStorage utilities
 * Tests serialization, quota management, error handling, and edge cases
 */

import {
  getConversations,
  setConversations,
  getDrafts,
  setDrafts,
  getTheme,
  setTheme,
  checkStorageQuota,
  clearExpiredData,
  clearAllStorage,
} from "./storage";
import { Conversation, Message } from "@/types";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("Storage Utilities", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getConversations", () => {
    it("should return empty array when no conversations are stored", () => {
      const conversations = getConversations();
      expect(conversations).toEqual([]);
    });

    it("should retrieve stored conversations with proper Date parsing", () => {
      const mockConversations: Conversation[] = [
        {
          id: "conv-1",
          title: "Test Conversation",
          createdAt: new Date("2024-01-15T10:30:00Z"),
          updatedAt: new Date("2024-01-15T12:45:00Z"),
          messages: [
            {
              id: "msg-1",
              role: "user",
              content: "Hello",
              timestamp: new Date("2024-01-15T10:30:00Z"),
            },
            {
              id: "msg-2",
              role: "assistant",
              content: "Hi there",
              timestamp: new Date("2024-01-15T10:31:00Z"),
            },
          ],
        },
      ];

      setConversations(mockConversations);
      const retrieved = getConversations();

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].id).toBe("conv-1");
      expect(retrieved[0].createdAt).toBeInstanceOf(Date);
      expect(retrieved[0].messages[0].timestamp).toBeInstanceOf(Date);
    });

    it("should handle edited message metadata", () => {
      const mockConversations: Conversation[] = [
        {
          id: "conv-1",
          title: "Test",
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [
            {
              id: "msg-1",
              role: "user",
              content: "Original text",
              timestamp: new Date(),
              isEdited: true,
              editedAt: new Date("2024-01-15T11:00:00Z"),
            },
          ],
        },
      ];

      setConversations(mockConversations);
      const retrieved = getConversations();

      expect(retrieved[0].messages[0].isEdited).toBe(true);
      expect(retrieved[0].messages[0].editedAt).toBeInstanceOf(Date);
    });

    it("should return empty array on parse error", () => {
      localStorage.setItem("conversations", "invalid json {");
      const conversations = getConversations();
      expect(conversations).toEqual([]);
    });

    it("should handle missing optional fields in messages", () => {
      const mockConversations: Conversation[] = [
        {
          id: "conv-1",
          title: "Test",
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [
            {
              id: "msg-1",
              role: "user",
              content: "Test",
              timestamp: new Date(),
              // No isEdited, editedAt, or wordCount
            },
          ],
        },
      ];

      setConversations(mockConversations);
      const retrieved = getConversations();

      expect(retrieved[0].messages[0].isEdited).toBeUndefined();
      expect(retrieved[0].messages[0].editedAt).toBeUndefined();
      expect(retrieved[0].messages[0].wordCount).toBeUndefined();
    });
  });

  describe("setConversations", () => {
    it("should serialize and store conversations", () => {
      const mockConversations: Conversation[] = [
        {
          id: "conv-1",
          title: "Test",
          createdAt: new Date("2024-01-15T10:30:00Z"),
          updatedAt: new Date("2024-01-15T10:30:00Z"),
          messages: [],
        },
      ];

      setConversations(mockConversations);
      const stored = localStorage.getItem("conversations");

      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toHaveLength(1);
    });

    it("should handle multiple conversations", () => {
      const mockConversations: Conversation[] = [
        {
          id: "conv-1",
          title: "First",
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [],
        },
        {
          id: "conv-2",
          title: "Second",
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [],
        },
      ];

      setConversations(mockConversations);
      const retrieved = getConversations();

      expect(retrieved).toHaveLength(2);
      expect(retrieved[0].title).toBe("First");
      expect(retrieved[1].title).toBe("Second");
    });
  });

  describe("getDrafts", () => {
    it("should return empty object when no drafts are stored", () => {
      const drafts = getDrafts();
      expect(drafts).toEqual({});
    });

    it("should retrieve stored drafts", () => {
      const mockDrafts = {
        "conv-1": "This is a draft message",
        "conv-2": "Another draft",
      };

      setDrafts(mockDrafts);
      const retrieved = getDrafts();

      expect(retrieved).toEqual(mockDrafts);
    });

    it("should handle parse error", () => {
      localStorage.setItem("drafts", "invalid json");
      const drafts = getDrafts();
      expect(drafts).toEqual({});
    });
  });

  describe("setDrafts", () => {
    it("should serialize and store drafts", () => {
      const mockDrafts = {
        "conv-1": "Draft text here",
      };

      setDrafts(mockDrafts);
      const stored = localStorage.getItem("drafts");

      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(mockDrafts);
    });

    it("should overwrite previous drafts", () => {
      setDrafts({ "conv-1": "First draft" });
      setDrafts({ "conv-2": "Second draft" });

      const retrieved = getDrafts();
      expect(retrieved).toEqual({ "conv-2": "Second draft" });
      expect(retrieved["conv-1"]).toBeUndefined();
    });
  });

  describe("getTheme", () => {
    it("should return null when no theme is stored", () => {
      const theme = getTheme();
      expect(theme).toBeNull();
    });

    it("should retrieve stored light theme", () => {
      setTheme("light");
      const theme = getTheme();
      expect(theme).toBe("light");
    });

    it("should retrieve stored dark theme", () => {
      setTheme("dark");
      const theme = getTheme();
      expect(theme).toBe("dark");
    });

    it("should return null for invalid theme values", () => {
      localStorage.setItem("theme", "invalid");
      const theme = getTheme();
      expect(theme).toBeNull();
    });
  });

  describe("setTheme", () => {
    it("should persist light theme", () => {
      setTheme("light");
      const stored = localStorage.getItem("theme");
      expect(stored).toBe("light");
    });

    it("should persist dark theme", () => {
      setTheme("dark");
      const stored = localStorage.getItem("theme");
      expect(stored).toBe("dark");
    });

    it("should overwrite previous theme", () => {
      setTheme("light");
      setTheme("dark");
      expect(getTheme()).toBe("dark");
    });
  });

  describe("checkStorageQuota", () => {
    it("should return quota information", () => {
      const quota = checkStorageQuota();

      expect(quota).toHaveProperty("available");
      expect(quota).toHaveProperty("percentUsed");
      expect(typeof quota.available).toBe("boolean");
      expect(typeof quota.percentUsed).toBe("number");
    });

    it("should return available=true when usage is low", () => {
      const quota = checkStorageQuota();
      expect(quota.available).toBe(true);
      expect(quota.percentUsed).toBeLessThan(90);
    });

    it("should cap percentUsed at 100", () => {
      const quota = checkStorageQuota();
      expect(quota.percentUsed).toBeLessThanOrEqual(100);
    });

    it("should track storage as data is added", () => {
      const quota1 = checkStorageQuota();

      setConversations([
        {
          id: "conv-1",
          title: "Test",
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: Array(50)
            .fill(null)
            .map((_, i) => ({
              id: `msg-${i}`,
              role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
              content: "x".repeat(500),
              timestamp: new Date(),
            })),
        },
      ]);

      const quota2 = checkStorageQuota();
      expect(quota2.percentUsed).toBeGreaterThanOrEqual(quota1.percentUsed);
    });
  });

  describe("clearExpiredData", () => {
    it("should remove conversations older than maxDays", () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
      const recentDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      const mockConversations: Conversation[] = [
        {
          id: "conv-old",
          title: "Old",
          createdAt: oldDate,
          updatedAt: oldDate,
          messages: [],
        },
        {
          id: "conv-recent",
          title: "Recent",
          createdAt: recentDate,
          updatedAt: recentDate,
          messages: [],
        },
      ];

      setConversations(mockConversations);
      clearExpiredData(90);

      const remaining = getConversations();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe("conv-recent");
    });

    it("should keep all conversations when maxDays is large", () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);

      const mockConversations: Conversation[] = [
        {
          id: "conv-old",
          title: "Old",
          createdAt: oldDate,
          updatedAt: oldDate,
          messages: [],
        },
      ];

      setConversations(mockConversations);
      clearExpiredData(200);

      const remaining = getConversations();
      expect(remaining).toHaveLength(1);
    });

    it("should not affect storage when no data is expired", () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const mockConversations: Conversation[] = [
        {
          id: "conv-1",
          title: "Recent",
          createdAt: recentDate,
          updatedAt: recentDate,
          messages: [],
        },
      ];

      setConversations(mockConversations);
      clearExpiredData(90);

      const remaining = getConversations();
      expect(remaining).toHaveLength(1);
    });
  });

  describe("clearAllStorage", () => {
    it("should clear all storage entries", () => {
      setConversations([
        {
          id: "conv-1",
          title: "Test",
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [],
        },
      ]);
      setDrafts({ "conv-1": "draft" });
      setTheme("dark");

      clearAllStorage();

      expect(getConversations()).toEqual([]);
      expect(getDrafts()).toEqual({});
      expect(getTheme()).toBeNull();
    });

    it("should handle clearing empty storage", () => {
      // Should not throw
      expect(() => clearAllStorage()).not.toThrow();
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle Date serialization correctly", () => {
      const date = new Date("2024-12-15T14:30:45.123Z");
      const conv: Conversation = {
        id: "conv-1",
        title: "Test",
        createdAt: date,
        updatedAt: date,
        messages: [
          {
            id: "msg-1",
            role: "user",
            content: "Test",
            timestamp: date,
          },
        ],
      };

      setConversations([conv]);
      const retrieved = getConversations()[0];

      // Dates should be equal in value (timezone independent)
      expect(retrieved.createdAt.getTime()).toBe(date.getTime());
      expect(retrieved.messages[0].timestamp.getTime()).toBe(date.getTime());
    });

    it("should preserve all conversation properties including optional fields", () => {
      const conv: Conversation = {
        id: "conv-1",
        title: "Test",
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [
          {
            id: "msg-1",
            role: "user",
            content: "Test",
            timestamp: new Date(),
            isEdited: true,
            editedAt: new Date(),
            wordCount: 42,
          },
        ],
        isPinned: true,
        shareToken: "token-123",
      };

      setConversations([conv]);
      const retrieved = getConversations()[0];

      expect(retrieved.isPinned).toBe(true);
      expect(retrieved.shareToken).toBe("token-123");
      expect(retrieved.messages[0].wordCount).toBe(42);
    });

    it("should handle empty message content", () => {
      const conv: Conversation = {
        id: "conv-1",
        title: "Test",
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [
          {
            id: "msg-1",
            role: "user",
            content: "",
            timestamp: new Date(),
          },
        ],
      };

      setConversations([conv]);
      const retrieved = getConversations();

      expect(retrieved[0].messages[0].content).toBe("");
    });

    it("should handle large conversations", () => {
      const largeConv: Conversation = {
        id: "conv-1",
        title: "Large",
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: Array(1000)
          .fill(null)
          .map((_, i) => ({
            id: `msg-${i}`,
            role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
            content: `Message ${i}`,
            timestamp: new Date(),
          })),
      };

      setConversations([largeConv]);
      const retrieved = getConversations();

      expect(retrieved[0].messages).toHaveLength(1000);
    });
  });
});
