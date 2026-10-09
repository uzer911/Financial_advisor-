/**
 * Unit Tests for useConversations Hook
 * Tests conversation CRUD operations and localStorage persistence
 */

import { renderHook, act } from "@testing-library/react";
import { useConversations } from "./useConversations";
import { Conversation, Message } from "../types";

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

describe("useConversations Hook", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should initialize with empty conversations", () => {
    const { result } = renderHook(() => useConversations());

    expect(result.current.conversations).toEqual([]);
    expect(result.current.currentConversation).toBeUndefined();
    expect(result.current.currentConversationId).toBeNull();
  });

  it("should load conversations from localStorage on mount", () => {
    const mockConversations: Conversation[] = [
      {
        id: "conv-1",
        title: "Test Conversation",
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-01-15"),
        messages: [],
      },
    ];

    localStorage.setItem("conversations", JSON.stringify(mockConversations));

    const { result } = renderHook(() => useConversations());

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0].title).toBe("Test Conversation");
  });

  it("should add a new conversation to the top of the list", () => {
    const { result } = renderHook(() => useConversations());

    const newConv: Conversation = {
      id: "conv-1",
      title: "New Chat",
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };

    act(() => {
      result.current.addConversation(newConv);
    });

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0].id).toBe("conv-1");
  });

  it("should add new conversations to the beginning of the list", () => {
    const { result } = renderHook(() => useConversations());

    const conv1: Conversation = {
      id: "conv-1",
      title: "First",
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };

    const conv2: Conversation = {
      id: "conv-2",
      title: "Second",
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };

    act(() => {
      result.current.addConversation(conv1);
      result.current.addConversation(conv2);
    });

    expect(result.current.conversations[0].id).toBe("conv-2");
    expect(result.current.conversations[1].id).toBe("conv-1");
  });

  it("should update a conversation", () => {
    const { result } = renderHook(() => useConversations());

    const conv: Conversation = {
      id: "conv-1",
      title: "Original Title",
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };

    act(() => {
      result.current.addConversation(conv);
    });

    act(() => {
      result.current.updateConversation("conv-1", { title: "Updated Title" });
    });

    expect(result.current.conversations[0].title).toBe("Updated Title");
  });

  it("should delete a conversation", () => {
    const { result } = renderHook(() => useConversations());

    const conv: Conversation = {
      id: "conv-1",
      title: "To Delete",
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };

    act(() => {
      result.current.addConversation(conv);
    });

    expect(result.current.conversations).toHaveLength(1);

    act(() => {
      result.current.deleteConversation("conv-1");
    });

    expect(result.current.conversations).toHaveLength(0);
  });

  it("should clear current conversation when deleted", () => {
    const { result } = renderHook(() => useConversations());

    const conv: Conversation = {
      id: "conv-1",
      title: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };

    act(() => {
      result.current.addConversation(conv);
      result.current.setCurrentConversationId("conv-1");
    });

    expect(result.current.currentConversationId).toBe("conv-1");

    act(() => {
      result.current.deleteConversation("conv-1");
    });

    expect(result.current.currentConversationId).toBeNull();
  });

  it("should set and return current conversation", () => {
    const { result } = renderHook(() => useConversations());

    const conv: Conversation = {
      id: "conv-1",
      title: "Current",
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };

    act(() => {
      result.current.addConversation(conv);
      result.current.setCurrentConversationId("conv-1");
    });

    expect(result.current.currentConversation).toEqual(conv);
  });

  it("should persist conversations to localStorage on change", () => {
    const { result } = renderHook(() => useConversations());

    const conv: Conversation = {
      id: "conv-1",
      title: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };

    act(() => {
      result.current.addConversation(conv);
    });

    const stored = localStorage.getItem("conversations");
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("conv-1");
  });

  it("should toggle pin status of a conversation", () => {
    const { result } = renderHook(() => useConversations());

    const conv: Conversation = {
      id: "conv-1",
      title: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };

    act(() => {
      result.current.addConversation(conv);
    });

    expect(result.current.conversations[0].isPinned).toBeUndefined();

    act(() => {
      result.current.pinConversation("conv-1");
    });

    expect(result.current.conversations[0].isPinned).toBe(true);

    act(() => {
      result.current.pinConversation("conv-1");
    });

    expect(result.current.conversations[0].isPinned).toBe(false);
  });

  it("should keep pinned conversations at the top", () => {
    const { result } = renderHook(() => useConversations());

    const conv1: Conversation = {
      id: "conv-1",
      title: "First",
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };

    const conv2: Conversation = {
      id: "conv-2",
      title: "Second",
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };

    act(() => {
      result.current.addConversation(conv1);
      result.current.addConversation(conv2);
    });

    act(() => {
      result.current.pinConversation("conv-1");
    });

    expect(result.current.conversations[0].id).toBe("conv-1");
    expect(result.current.conversations[0].isPinned).toBe(true);
    expect(result.current.conversations[1].id).toBe("conv-2");
  });

  it("should update message count when messages are added", () => {
    const { result } = renderHook(() => useConversations());

    let conv: Conversation = {
      id: "conv-1",
      title: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };

    act(() => {
      result.current.addConversation(conv);
    });

    const newMessage: Message = {
      id: "msg-1",
      role: "user",
      content: "Hello",
      timestamp: new Date(),
    };

    act(() => {
      result.current.updateConversation("conv-1", {
        messages: [newMessage],
      });
    });

    expect(result.current.conversations[0].messages).toHaveLength(1);
    expect(result.current.conversations[0].messages[0].content).toBe("Hello");
  });
});
