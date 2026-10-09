/**
 * Unit Tests for useKeyboardShortcuts Hook
 * Tests keyboard event handling and action dispatch
 */

import { renderHook } from "@testing-library/react";
import { useKeyboardShortcuts, useGlobalShortcuts } from "./useKeyboardShortcuts";

describe("useKeyboardShortcuts Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should handle Cmd+K shortcut", () => {
    const mockAction = jest.fn();
    const shortcuts = [
      {
        key: "cmd-k",
        action: mockAction,
        description: "Test",
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });

    const preventDefaultSpy = jest.spyOn(event, "preventDefault");

    window.dispatchEvent(event);

    expect(mockAction).toHaveBeenCalled();
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it("should handle Ctrl+K shortcut (Windows/Linux)", () => {
    const mockAction = jest.fn();
    const shortcuts = [
      {
        key: "cmd-k",
        action: mockAction,
        description: "Test",
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(mockAction).toHaveBeenCalled();
  });

  it("should handle Cmd+/ shortcut", () => {
    const mockAction = jest.fn();
    const shortcuts = [
      {
        key: "cmd-slash",
        action: mockAction,
        description: "Test",
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent("keydown", {
      key: "/",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(mockAction).toHaveBeenCalled();
  });

  it("should handle Escape key", () => {
    const mockAction = jest.fn();
    const shortcuts = [
      {
        key: "escape",
        action: mockAction,
        description: "Test",
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(mockAction).toHaveBeenCalled();
  });

  it("should handle Enter key", () => {
    const mockAction = jest.fn();
    const shortcuts = [
      {
        key: "enter",
        action: mockAction,
        description: "Test",
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(mockAction).toHaveBeenCalled();
  });

  it("should handle Shift+Enter key", () => {
    const mockAction = jest.fn();
    const shortcuts = [
      {
        key: "shift-enter",
        action: mockAction,
        description: "Test",
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(mockAction).toHaveBeenCalled();
  });

  it("should handle multiple shortcuts", () => {
    const mockAction1 = jest.fn();
    const mockAction2 = jest.fn();

    const shortcuts = [
      {
        key: "cmd-k",
        action: mockAction1,
        description: "Test 1",
      },
      {
        key: "escape",
        action: mockAction2,
        description: "Test 2",
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event1 = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event1);
    expect(mockAction1).toHaveBeenCalled();

    const event2 = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
    });
    window.dispatchEvent(event2);
    expect(mockAction2).toHaveBeenCalled();
  });

  it("should ignore unregistered shortcuts", () => {
    const mockAction = jest.fn();
    const shortcuts = [
      {
        key: "cmd-k",
        action: mockAction,
        description: "Test",
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Different shortcut
    const event = new KeyboardEvent("keydown", {
      key: "z",
      metaKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(mockAction).not.toHaveBeenCalled();
  });

  it("should remove event listener on unmount", () => {
    const removeEventListenerSpy = jest.spyOn(window, "removeEventListener");

    const shortcuts = [
      {
        key: "cmd-k",
        action: jest.fn(),
        description: "Test",
      },
    ];

    const { unmount } = renderHook(() => useKeyboardShortcuts(shortcuts));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });
});

describe("useGlobalShortcuts Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should register Cmd+K shortcut", () => {
    const mockCmdK = jest.fn();

    renderHook(() =>
      useGlobalShortcuts({
        onCmdK: mockCmdK,
      })
    );

    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(mockCmdK).toHaveBeenCalled();
  });

  it("should register Cmd+/ shortcut", () => {
    const mockCmdSlash = jest.fn();

    renderHook(() =>
      useGlobalShortcuts({
        onCmdSlash: mockCmdSlash,
      })
    );

    const event = new KeyboardEvent("keydown", {
      key: "/",
      metaKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(mockCmdSlash).toHaveBeenCalled();
  });

  it("should register Cmd+N shortcut", () => {
    const mockCmdN = jest.fn();

    renderHook(() =>
      useGlobalShortcuts({
        onCmdN: mockCmdN,
      })
    );

    const event = new KeyboardEvent("keydown", {
      key: "n",
      metaKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(mockCmdN).toHaveBeenCalled();
  });

  it("should register Cmd+F shortcut", () => {
    const mockCmdF = jest.fn();

    renderHook(() =>
      useGlobalShortcuts({
        onCmdF: mockCmdF,
      })
    );

    const event = new KeyboardEvent("keydown", {
      key: "f",
      metaKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(mockCmdF).toHaveBeenCalled();
  });

  it("should register Escape shortcut", () => {
    const mockEscape = jest.fn();

    renderHook(() =>
      useGlobalShortcuts({
        onEscape: mockEscape,
      })
    );

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(mockEscape).toHaveBeenCalled();
  });

  it("should register Enter shortcut", () => {
    const mockEnter = jest.fn();

    renderHook(() =>
      useGlobalShortcuts({
        onEnter: mockEnter,
      })
    );

    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(mockEnter).toHaveBeenCalled();
  });

  it("should register Shift+Enter shortcut", () => {
    const mockShiftEnter = jest.fn();

    renderHook(() =>
      useGlobalShortcuts({
        onShiftEnter: mockShiftEnter,
      })
    );

    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      shiftKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(mockShiftEnter).toHaveBeenCalled();
  });

  it("should register multiple shortcuts together", () => {
    const mockCmdK = jest.fn();
    const mockCmdSlash = jest.fn();
    const mockEscape = jest.fn();

    renderHook(() =>
      useGlobalShortcuts({
        onCmdK: mockCmdK,
        onCmdSlash: mockCmdSlash,
        onEscape: mockEscape,
      })
    );

    const event1 = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event1);

    const event2 = new KeyboardEvent("keydown", {
      key: "/",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event2);

    const event3 = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
    });
    window.dispatchEvent(event3);

    expect(mockCmdK).toHaveBeenCalled();
    expect(mockCmdSlash).toHaveBeenCalled();
    expect(mockEscape).toHaveBeenCalled();
  });

  it("should ignore unregistered shortcuts when using useGlobalShortcuts", () => {
    const mockCmdK = jest.fn();

    renderHook(() =>
      useGlobalShortcuts({
        onCmdK: mockCmdK,
      })
    );

    // Different shortcut not registered
    const event = new KeyboardEvent("keydown", {
      key: "j",
      metaKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(mockCmdK).not.toHaveBeenCalled();
  });
});
