/**
 * useTheme Hook
 * 
 * Manages dark mode state with system preference detection and persistence.
 * Applies theme by toggling "dark-mode" class on document root.
 * 
 * Validates: Requirements 8.1, 8.2, 21.1
 */

import { useState, useEffect } from "react";

const STORAGE_KEY = "theme";
const DARK_MODE_CLASS = "dark-mode";

type ThemeMode = "light" | "dark";

/**
 * Hook for managing theme (light/dark mode) with system preference detection
 */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [isInitialized, setIsInitialized] = useState(false);

  /**
   * Initialize theme on mount:
   * 1. Check localStorage for saved preference
   * 2. Fall back to system preference
   * 3. Apply to document and state
   */
  useEffect(() => {
    // Temporarily add no-transition class to prevent flash on load
    if (typeof document !== "undefined") {
      document.documentElement.classList.add("no-transition");
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      let initialTheme: ThemeMode;

      if (saved === "light" || saved === "dark") {
        // Use persisted preference
        initialTheme = saved;
      } else {
        // Detect system preference
        const isDarkMode = window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;
        initialTheme = isDarkMode ? "dark" : "light";
      }

      setTheme(initialTheme);

      // Apply to document
      if (initialTheme === "dark") {
        document.documentElement.classList.add(DARK_MODE_CLASS);
      } else {
        document.documentElement.classList.remove(DARK_MODE_CLASS);
      }
    } catch (error) {
      console.error("Failed to initialize theme:", error);
      setTheme("light");
    }

    // Remove no-transition class after initial setup
    if (typeof document !== "undefined") {
      // Use requestAnimationFrame to ensure class is applied before removal
      requestAnimationFrame(() => {
        document.documentElement.classList.remove("no-transition");
      });
    }

    setIsInitialized(true);
  }, []);

  /**
   * Toggle between light and dark themes
   */
  const toggleTheme = () => {
    setTheme((prevTheme) => {
      const newTheme: ThemeMode = prevTheme === "light" ? "dark" : "light";

      // Save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, newTheme);
      } catch (error) {
        console.error("Failed to save theme preference:", error);
      }

      // Apply to document
      if (newTheme === "dark") {
        document.documentElement.classList.add(DARK_MODE_CLASS);
      } else {
        document.documentElement.classList.remove(DARK_MODE_CLASS);
      }

      return newTheme;
    });
  };

  return {
    theme,
    toggleTheme,
    isInitialized,
  };
}
