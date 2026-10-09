/**
 * Unit Tests for useDrafts Hook
 * Tests draft auto-save, retrieval, and clearing
 */

import { renderHook, act } from "@testing-library/react";
import { useDrafts } from "./useDrafts";

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

jest.useFakeTimers();

describe("useDrafts Hook", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it("should initialize with empty drafts", () => {
    const { result } = renderHook(() => useDrafts());

    expect(result.current.drafts).toEqual({});
  });

  it("should load drafts from localStorage on mount", () => {
    const mockDrafts = {
      "conv-1": "Draft text for conversation 1",
      "conv-2": "Draft text for conversation 2",
    };

    localStorage.setItem("drafts", JSON.stringify(mockDrafts));

    const { result } = renderHook(() => useDrafts());

    expect(result.current.drafts).toEqual(mockDrafts);
  });

  it("should set a new draft", () => {
    const { result } = renderHook(() => useDrafts());

    act(() => {
      result.current.setDraft("conv-1", "Hello, this is a draft");
    });

    expect(result.current.drafts["conv-1"]).toBe("Hello, this is a draft");
  });

  it("should update existing draft", () => {
    const { result } = renderHook(() => useDrafts());

    act(() => {
      result.current.setDraft("conv-1", "First draft");
    });

    act(() => {
      result.current.setDraft("conv-1", "Updated draft");
    });

    expect(result.current.drafts["conv-1"]).toBe("Updated draft");
  });

  it("should get a draft for a conversation", () => {
    const { result } = renderHook(() => useDrafts());

    act(() => {
      result.current.setDraft("conv-1", "Test draft");
    });

    const draft = result.current.getDraft("conv-1");

    expect(draft).toBe("Test draft");
  });

  it("should return empty string for non-existent draft", () => {
    const { result } = renderHook(() => useDrafts());

    const draft = result.current.getDraft("non-existent");

    expect(draft).toBe("");
  });

  it("should clear a draft", () => {
    const { result } = renderHook(() => useDrafts());

    act(() => {
      result.current.setDraft("conv-1", "Draft to clear");
    });

    expect(result.current.drafts["conv-1"]).toBe("Draft to clear");

    act(() => {
      result.current.clearDraft("conv-1");
    });

    expect(result.current.drafts["conv-1"]).toBeUndefined();
  });

  it("should auto-save drafts to localStorage every 2 seconds", () => {
    const { result } = renderHook(() => useDrafts());

    act(() => {
      result.current.setDraft("conv-1", "New draft");
    });

    // Fast-forward time by 2 seconds
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    const stored = localStorage.getItem("drafts");
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored!);
    expect(parsed["conv-1"]).toBe("New draft");
  });

  it("should persist multiple drafts", () => {
    const { result } = renderHook(() => useDrafts());

    act(() => {
      result.current.setDraft("conv-1", "Draft 1");
      result.current.setDraft("conv-2", "Draft 2");
      result.current.setDraft("conv-3", "Draft 3");
    });

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    const stored = localStorage.getItem("drafts");
    const parsed = JSON.parse(stored!);
    expect(Object.keys(parsed)).toHaveLength(3);
    expect(parsed["conv-1"]).toBe("Draft 1");
    expect(parsed["conv-2"]).toBe("Draft 2");
    expect(parsed["conv-3"]).toBe("Draft 3");
  });

  it("should handle localStorage errors gracefully", () => {
    localStorage.setItem = jest.fn(() => {
      throw new Error("Storage full");
    });

    const { result } = renderHook(() => useDrafts());

    // Should not throw when setting draft
    act(() => {
      result.current.setDraft("conv-1", "Draft");
    });

    // State should still be updated locally
    expect(result.current.drafts["conv-1"]).toBe("Draft");
  });

  it("should clear all drafts when cleared individually", () => {
    const { result } = renderHook(() => useDrafts());

    act(() => {
      result.current.setDraft("conv-1", "Draft 1");
      result.current.setDraft("conv-2", "Draft 2");
    });

    act(() => {
      result.current.clearDraft("conv-1");
      result.current.clearDraft("conv-2");
    });

    expect(result.current.drafts).toEqual({});
  });

  it("should preserve other drafts when clearing one", () => {
    const { result } = renderHook(() => useDrafts());

    act(() => {
      result.current.setDraft("conv-1", "Draft 1");
      result.current.setDraft("conv-2", "Draft 2");
      result.current.setDraft("conv-3", "Draft 3");
    });

    act(() => {
      result.current.clearDraft("conv-2");
    });

    expect(result.current.drafts["conv-1"]).toBe("Draft 1");
    expect(result.current.drafts["conv-2"]).toBeUndefined();
    expect(result.current.drafts["conv-3"]).toBe("Draft 3");
  });

  it("should handle empty draft text", () => {
    const { result } = renderHook(() => useDrafts());

    act(() => {
      result.current.setDraft("conv-1", "");
    });

    expect(result.current.drafts["conv-1"]).toBe("");
  });

  it("should handle large draft text", () => {
    const { result } = renderHook(() => useDrafts());

    const largeDraft = "A".repeat(10000); // 10KB of text

    act(() => {
      result.current.setDraft("conv-1", largeDraft);
    });

    expect(result.current.drafts["conv-1"]).toBe(largeDraft);
    expect(result.current.getDraft("conv-1")).toBe(largeDraft);
  });

  it("should clear interval on unmount", () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");

    const { unmount } = renderHook(() => useDrafts());

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
  });
});
