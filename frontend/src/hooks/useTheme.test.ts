/**
 * Unit Tests for useTheme Hook
 * Tests theme switching, system preference detection, and persistence
 */

import { renderHook, act } from "@testing-library/react";
import { useTheme } from "./useTheme";

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

describe("useTheme Hook", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark-mode");
    document.documentElement.classList.remove("no-transition");
    // Reset matchMedia to default light preference
    const mockMatchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    });
    window.matchMedia = mockMatchMedia as any;
  });

  it("should initialize with light mode by default", async () => {
    const { result } = renderHook(() => useTheme());

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.current.theme).toBe("light");
    expect(result.current.isInitialized).toBe(true);
  });

  it("should detect system dark preference on first load", async () => {
    // Mock matchMedia to return dark preference
    const mockMatchMedia = (query: string) => ({
      matches: query === "(prefers-color-scheme: dark)",
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    });

    window.matchMedia = mockMatchMedia as any;

    const { result } = renderHook(() => useTheme());

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.current.theme).toBe("dark");
  });

  it("should load theme from localStorage if available", async () => {
    localStorage.setItem("theme", "dark");

    const { result } = renderHook(() => useTheme());

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.current.theme).toBe("dark");
  });

  it("should prioritize localStorage over system preference", async () => {
    localStorage.setItem("theme", "light");

    const mockMatchMedia = (query: string) => ({
      matches: query === "(prefers-color-scheme: dark)",
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    });

    window.matchMedia = mockMatchMedia as any;

    const { result } = renderHook(() => useTheme());

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.current.theme).toBe("light");
  });

  it("should toggle theme from light to dark", async () => {
    const { result } = renderHook(() => useTheme());

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.current.theme).toBe("light");
    expect(result.current.isInitialized).toBe(true);

    act(() => {
      result.current.toggleTheme();
    });

    // Wait for state update
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.current.theme).toBe("dark");
  });

  it("should toggle theme from dark to light", async () => {
    localStorage.setItem("theme", "dark");

    const { result } = renderHook(() => useTheme());

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.current.theme).toBe("dark");
    expect(result.current.isInitialized).toBe(true);

    act(() => {
      result.current.toggleTheme();
    });

    // Wait for state update
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.current.theme).toBe("light");
  });

  it("should apply dark-mode class to document element when switching to dark", async () => {
    const { result } = renderHook(() => useTheme());

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Initially light mode, no dark-mode class
    expect(
      document.documentElement.classList.contains("dark-mode")
    ).toBe(false);

    act(() => {
      result.current.toggleTheme();
    });

    // Wait for state update
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.documentElement.classList.contains("dark-mode")).toBe(true);
  });

  it("should remove dark-mode class when switching back to light", async () => {
    localStorage.setItem("theme", "dark");

    const { result } = renderHook(() => useTheme());

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.documentElement.classList.contains("dark-mode")).toBe(true);

    act(() => {
      result.current.toggleTheme();
    });

    // Wait for state update
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(
      document.documentElement.classList.contains("dark-mode")
    ).toBe(false);
  });

  it("should persist theme preference to localStorage on toggle", async () => {
    const { result } = renderHook(() => useTheme());

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.current.theme).toBe("light");

    act(() => {
      result.current.toggleTheme();
    });

    // Wait for state update
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("should have isInitialized flag after mount", async () => {
    const { result } = renderHook(() => useTheme());

    // Check initial state - may or may not be initialized yet
    const initialState = result.current.isInitialized;

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(result.current.isInitialized).toBe(true);
  });

  it("should handle localStorage errors gracefully", async () => {
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = jest.fn(() => {
      throw new Error("Storage full");
    });

    const { result } = renderHook(() => useTheme());

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should still work, just not persist
    act(() => {
      result.current.toggleTheme();
    });

    // Wait for state update
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.current.theme).toBe("dark");

    localStorage.setItem = originalSetItem;
  });
});
