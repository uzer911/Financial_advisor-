/**
 * Error handling utilities for categorizing errors and implementing retry logic
 * Provides user-friendly error messages and suggestions for different error types
 */

import { AppError } from "@/types";

/**
 * Error message mapping with user-friendly text and actionable suggestions
 */
export const ERROR_MESSAGES: Record<
  AppError["category"],
  { message: string; suggestion: string; retryable: boolean }
> = {
  network: {
    message: "Network connection lost",
    suggestion: "Check your internet connection and try again",
    retryable: true,
  },
  auth: {
    message: "Authentication failed",
    suggestion: "Please sign in again",
    retryable: false,
  },
  backend: {
    message: "The service is temporarily unavailable",
    suggestion: "Try again in a moment",
    retryable: true,
  },
  validation: {
    message: "Invalid input",
    suggestion: "Please check your message and try again",
    retryable: false,
  },
  unknown: {
    message: "Something went wrong",
    suggestion: "Please try again or contact support",
    retryable: true,
  },
};

/**
 * Check if an error is network-related
 * @param error Unknown error to check
 * @returns True if error is network-related
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    // Network errors in fetch API throw TypeError
    return (
      error.message.includes("fetch") ||
      error.message.includes("network") ||
      error.message.includes("Failed to fetch")
    );
  }

  if (error instanceof Error) {
    return (
      error.message.includes("Network") ||
      error.message.includes("connection")
    );
  }

  return false;
}

/**
 * Check if an error is authentication-related
 * @param error Unknown error to check
 * @returns True if error is authentication-related (401)
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    if ("status" in error && error.status === 401) {
      return true;
    }
    return error.message.includes("Unauthorized") || error.message.includes("401");
  }

  if (typeof error === "object" && error !== null) {
    if ("status" in error && error.status === 401) {
      return true;
    }
  }

  return false;
}

/**
 * Check if an error is backend-related
 * @param error Unknown error to check
 * @returns True if error is backend error (5xx)
 */
export function isBackendError(error: unknown): boolean {
  if (typeof error === "object" && error !== null) {
    if ("status" in error) {
      const status = (error as { status: unknown }).status;
      if (typeof status === "number" && status >= 500) {
        return true;
      }
    }
  }

  if (error instanceof Error) {
    return (
      error.message.includes("500") ||
      error.message.includes("502") ||
      error.message.includes("503") ||
      error.message.includes("504")
    );
  }

  return false;
}

/**
 * Categorize an error into a standard error type
 * @param error Unknown error to categorize
 * @returns AppError with category, message, suggestion, and retryable flag
 */
export function categorizeError(error: unknown): AppError {
  const timestamp = new Date();

  // Check specific error types first
  if (isAuthError(error)) {
    return {
      category: "auth",
      message: ERROR_MESSAGES.auth.message,
      suggestion: ERROR_MESSAGES.auth.suggestion,
      retryable: ERROR_MESSAGES.auth.retryable,
      timestamp,
    };
  }

  if (isBackendError(error)) {
    return {
      category: "backend",
      message: ERROR_MESSAGES.backend.message,
      suggestion: ERROR_MESSAGES.backend.suggestion,
      retryable: ERROR_MESSAGES.backend.retryable,
      timestamp,
    };
  }

  if (isNetworkError(error)) {
    return {
      category: "network",
      message: ERROR_MESSAGES.network.message,
      suggestion: ERROR_MESSAGES.network.suggestion,
      retryable: ERROR_MESSAGES.network.retryable,
      timestamp,
    };
  }

  // Check for validation errors (4xx that aren't 401)
  if (typeof error === "object" && error !== null) {
    if (
      "status" in error &&
      typeof (error as { status: unknown }).status === "number"
    ) {
      const status = (error as { status: number }).status;
      if (status >= 400 && status < 500 && status !== 401) {
        return {
          category: "validation",
          message: ERROR_MESSAGES.validation.message,
          suggestion: ERROR_MESSAGES.validation.suggestion,
          retryable: ERROR_MESSAGES.validation.retryable,
          timestamp,
        };
      }
    }
  }

  // Default to unknown
  return {
    category: "unknown",
    message: ERROR_MESSAGES.unknown.message,
    suggestion: ERROR_MESSAGES.unknown.suggestion,
    retryable: ERROR_MESSAGES.unknown.retryable,
    timestamp,
  };
}

/**
 * Retry a function with exponential backoff
 * Implements 1s, 2s, 4s backoff delays between attempts
 *
 * @param fn Async function to retry
 * @param maxAttempts Maximum number of attempts (default: 3)
 * @returns Promise that resolves with function result or rejects with final error
 *
 * @example
 * const result = await retryWithBackoff(
 *   () => fetch('/api/message', { method: 'POST', body: messageText }),
 *   3
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if error is not retryable
      const appError = categorizeError(error);
      if (!appError.retryable) {
        throw error;
      }

      // Don't wait after final attempt
      if (attempt < maxAttempts) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // If we get here, all retries failed
  throw lastError;
}

/**
 * Format a retry attempt message for display to user
 * @param attempt Current attempt number
 * @param maxAttempts Total number of attempts
 * @returns Formatted message like "attempt 1/3"
 */
export function formatRetryAttempt(attempt: number, maxAttempts: number): string {
  return `(attempt ${attempt}/${maxAttempts})`;
}
