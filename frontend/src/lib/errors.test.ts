/**
 * Unit tests for error handling utilities
 * Tests error categorization, retry logic, and error detection functions
 */

import {
  categorizeError,
  retryWithBackoff,
  isNetworkError,
  isAuthError,
  isBackendError,
  ERROR_MESSAGES,
  formatRetryAttempt,
} from "./errors";

describe("Error Handling Utilities", () => {
  describe("ERROR_MESSAGES", () => {
    it("should have all error categories defined", () => {
      expect(ERROR_MESSAGES.network).toBeDefined();
      expect(ERROR_MESSAGES.auth).toBeDefined();
      expect(ERROR_MESSAGES.backend).toBeDefined();
      expect(ERROR_MESSAGES.validation).toBeDefined();
      expect(ERROR_MESSAGES.unknown).toBeDefined();
    });

    it("should have message and suggestion for each category", () => {
      for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
        expect(value.message).toBeDefined();
        expect(value.message.length).toBeGreaterThan(0);
        expect(value.suggestion).toBeDefined();
        expect(value.suggestion.length).toBeGreaterThan(0);
        expect(typeof value.retryable).toBe("boolean");
      }
    });

    it("should mark network and backend as retryable", () => {
      expect(ERROR_MESSAGES.network.retryable).toBe(true);
      expect(ERROR_MESSAGES.backend.retryable).toBe(true);
      expect(ERROR_MESSAGES.unknown.retryable).toBe(true);
    });

    it("should mark auth and validation as non-retryable", () => {
      expect(ERROR_MESSAGES.auth.retryable).toBe(false);
      expect(ERROR_MESSAGES.validation.retryable).toBe(false);
    });
  });

  describe("isNetworkError", () => {
    it("should identify TypeError with fetch message as network error", () => {
      const error = new TypeError("Failed to fetch");
      expect(isNetworkError(error)).toBe(true);
    });

    it("should identify TypeError with network message as network error", () => {
      const error = new TypeError("network request failed");
      expect(isNetworkError(error)).toBe(true);
    });

    it("should identify error with connection message", () => {
      const error = new Error("connection refused");
      expect(isNetworkError(error)).toBe(true);
    });

    it("should not identify non-network errors", () => {
      const error = new Error("Something else");
      expect(isNetworkError(error)).toBe(false);
    });

    it("should handle non-Error objects", () => {
      expect(isNetworkError("not an error")).toBe(false);
      expect(isNetworkError(null)).toBe(false);
      expect(isNetworkError(undefined)).toBe(false);
    });
  });

  describe("isAuthError", () => {
    it("should identify 401 status code as auth error", () => {
      const error = { status: 401, message: "Unauthorized" };
      expect(isAuthError(error)).toBe(true);
    });

    it("should identify Unauthorized message as auth error", () => {
      const error = new Error("Unauthorized");
      expect(isAuthError(error)).toBe(true);
    });

    it("should identify 401 message as auth error", () => {
      const error = new Error("401 error");
      expect(isAuthError(error)).toBe(true);
    });

    it("should not identify non-auth errors", () => {
      const error = new Error("500 error");
      expect(isAuthError(error)).toBe(false);
    });

    it("should not identify 403/404 as auth errors", () => {
      expect(isAuthError({ status: 403 })).toBe(false);
      expect(isAuthError({ status: 404 })).toBe(false);
    });
  });

  describe("isBackendError", () => {
    it("should identify 500 status code as backend error", () => {
      const error = { status: 500 };
      expect(isBackendError(error)).toBe(true);
    });

    it("should identify 502 status code as backend error", () => {
      const error = { status: 502 };
      expect(isBackendError(error)).toBe(true);
    });

    it("should identify 503 status code as backend error", () => {
      const error = { status: 503 };
      expect(isBackendError(error)).toBe(true);
    });

    it("should identify 504 status code as backend error", () => {
      const error = { status: 504 };
      expect(isBackendError(error)).toBe(true);
    });

    it("should identify 500 message as backend error", () => {
      const error = new Error("500 Internal Server Error");
      expect(isBackendError(error)).toBe(true);
    });

    it("should not identify 4xx errors as backend errors", () => {
      expect(isBackendError({ status: 400 })).toBe(false);
      expect(isBackendError({ status: 401 })).toBe(false);
      expect(isBackendError({ status: 404 })).toBe(false);
    });

    it("should not identify 2xx/3xx errors as backend errors", () => {
      expect(isBackendError({ status: 200 })).toBe(false);
      expect(isBackendError({ status: 302 })).toBe(false);
    });
  });

  describe("categorizeError", () => {
    it("should categorize network error", () => {
      const error = new TypeError("Failed to fetch");
      const appError = categorizeError(error);

      expect(appError.category).toBe("network");
      expect(appError.message).toBe(ERROR_MESSAGES.network.message);
      expect(appError.suggestion).toBe(ERROR_MESSAGES.network.suggestion);
      expect(appError.retryable).toBe(true);
    });

    it("should categorize auth error", () => {
      const error = { status: 401, message: "Unauthorized" };
      const appError = categorizeError(error);

      expect(appError.category).toBe("auth");
      expect(appError.message).toBe(ERROR_MESSAGES.auth.message);
      expect(appError.retryable).toBe(false);
    });

    it("should categorize backend error (5xx)", () => {
      const error = { status: 503 };
      const appError = categorizeError(error);

      expect(appError.category).toBe("backend");
      expect(appError.message).toBe(ERROR_MESSAGES.backend.message);
      expect(appError.retryable).toBe(true);
    });

    it("should categorize validation error (4xx non-401)", () => {
      const error = { status: 400 };
      const appError = categorizeError(error);

      expect(appError.category).toBe("validation");
      expect(appError.message).toBe(ERROR_MESSAGES.validation.message);
      expect(appError.retryable).toBe(false);
    });

    it("should categorize 404 as validation error", () => {
      const error = { status: 404 };
      const appError = categorizeError(error);

      expect(appError.category).toBe("validation");
    });

    it("should categorize unknown error", () => {
      const error = new Error("Something unexpected");
      const appError = categorizeError(error);

      expect(appError.category).toBe("unknown");
      expect(appError.message).toBe(ERROR_MESSAGES.unknown.message);
      expect(appError.retryable).toBe(true);
    });

    it("should include timestamp in categorized error", () => {
      const error = new Error("Test error");
      const before = new Date();

      const appError = categorizeError(error);

      const after = new Date();
      expect(appError.timestamp).toBeInstanceOf(Date);
      expect(appError.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(appError.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should handle null/undefined", () => {
      const appError1 = categorizeError(null);
      const appError2 = categorizeError(undefined);

      expect(appError1.category).toBe("unknown");
      expect(appError2.category).toBe("unknown");
    });

    it("should prioritize specific error types in order", () => {
      // Auth should be checked before other errors
      const authError = { status: 401, category: "auth" };
      expect(categorizeError(authError).category).toBe("auth");

      // Backend should be checked after auth
      const backendError = { status: 500 };
      expect(categorizeError(backendError).category).toBe("backend");

      // Network should be checked after backend
      const networkError = new TypeError("Failed to fetch");
      expect(categorizeError(networkError).category).toBe("network");
    });
  });

  describe("retryWithBackoff", () => {
    it("should call function once and return on success", async () => {
      const mockFn = jest.fn().mockResolvedValue("success");

      const result = await retryWithBackoff(mockFn, 3);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(result).toBe("success");
    });

    it("should retry on network error", async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce("success");

      const result = await retryWithBackoff(mockFn, 3);

      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(result).toBe("success");
    }, 10000);

    it("should retry backend errors", async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValueOnce("success");

      const result = await retryWithBackoff(mockFn, 3);

      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(result).toBe("success");
    }, 10000);

    it("should throw after max attempts exceeded", async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValue(new TypeError("Failed to fetch"));

      try {
        await retryWithBackoff(mockFn, 3);
        fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TypeError);
        expect(mockFn).toHaveBeenCalledTimes(3);
      }
    }, 15000);

    it("should not retry non-retryable errors (auth)", async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce({ status: 401 }); // Auth error - non-retryable

      try {
        await retryWithBackoff(mockFn, 3);
        fail("Should have thrown");
      } catch (error) {
        expect(mockFn).toHaveBeenCalledTimes(1);
        expect((error as any).status).toBe(401);
      }
    });

    it("should not retry validation errors", async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce({ status: 400 }); // Validation error - non-retryable

      try {
        await retryWithBackoff(mockFn, 3);
        fail("Should have thrown");
      } catch (error) {
        expect(mockFn).toHaveBeenCalledTimes(1);
      }
    });

    it("should default to 3 attempts", async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValue(new TypeError("Failed to fetch"));

      try {
        await retryWithBackoff(mockFn);
        fail("Should have thrown");
      } catch {
        expect(mockFn).toHaveBeenCalledTimes(3);
      }
    }, 15000);
  });

  describe("formatRetryAttempt", () => {
    it("should format attempt counter", () => {
      expect(formatRetryAttempt(1, 3)).toBe("(attempt 1/3)");
      expect(formatRetryAttempt(2, 3)).toBe("(attempt 2/3)");
      expect(formatRetryAttempt(3, 3)).toBe("(attempt 3/3)");
    });

    it("should work with different max attempts", () => {
      expect(formatRetryAttempt(1, 5)).toBe("(attempt 1/5)");
      expect(formatRetryAttempt(5, 5)).toBe("(attempt 5/5)");
    });
  });

  describe("Integration", () => {
    it("should correctly categorize and determine retryability", () => {
      const errors = [
        { input: new TypeError("Failed to fetch"), expectedRetryable: true },
        { input: { status: 401 }, expectedRetryable: false },
        { input: { status: 500 }, expectedRetryable: true },
        { input: { status: 400 }, expectedRetryable: false },
        { input: new Error("Unknown"), expectedRetryable: true },
      ];

      errors.forEach(({ input, expectedRetryable }) => {
        const appError = categorizeError(input);
        expect(appError.retryable).toBe(expectedRetryable);
      });
    });

    it("should provide user-friendly messages for different error scenarios", () => {
      const scenarios = [
        {
          error: new TypeError("Failed to fetch"),
          expectedMessage: "Network connection lost",
        },
        { error: { status: 401 }, expectedMessage: "Authentication failed" },
        {
          error: { status: 503 },
          expectedMessage: "The service is temporarily unavailable",
        },
        { error: { status: 400 }, expectedMessage: "Invalid input" },
        { error: new Error("Unknown"), expectedMessage: "Something went wrong" },
      ];

      scenarios.forEach(({ error, expectedMessage }) => {
        const appError = categorizeError(error);
        expect(appError.message).toBe(expectedMessage);
        expect(appError.suggestion).toBeDefined();
      });
    });
  });
});

// Helper for test readability
function greaterThan(n: number) {
  return n;
}
