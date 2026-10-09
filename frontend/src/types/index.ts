/**
 * Core data types for the Financial Advisor chat application
 */

/**
 * Represents a single message in a conversation
 */
export interface Message {
  id: string; // Unique message identifier
  role: "user" | "assistant"; // Sender type
  content: string; // Raw text or markdown content
  timestamp: Date; // When the message was sent
  isEdited?: boolean; // Whether the message has been edited
  editedAt?: Date; // When the message was last edited
  wordCount?: number; // Number of words (for export/stats)
}

/**
 * Represents a conversation thread
 */
export interface Conversation {
  id: string; // UUID or timestamp-based unique identifier
  title: string; // User-editable or auto-generated title
  createdAt: Date; // When the conversation was created
  updatedAt: Date; // Last message or edit timestamp
  messages: Message[]; // Full message history
  isArchived?: boolean; // For future soft-delete functionality
  isPinned?: boolean; // Whether conversation is pinned to top
  shareToken?: string; // Unique token for sharing conversation (future)
}

/**
 * Theme state for dark mode management
 */
export interface ThemeState {
  mode: "light" | "dark"; // Current theme mode
  systemPreference: boolean; // true = follow OS, false = manual override
}

/**
 * Draft state for auto-save functionality
 */
export interface Draft {
  conversationId: string; // ID of conversation this draft belongs to
  content: string; // Draft message text
  savedAt: Date; // When draft was last saved
}

/**
 * Command palette item for keyboard shortcuts
 */
export interface CommandPaletteItem {
  id: string; // Unique command identifier
  title: string; // Display title
  description?: string; // Optional description
  action: () => void; // Callback when command is executed
  category: "navigation" | "edit" | "export" | "theme"; // Grouping category
  shortcut?: string; // Display shortcut (e.g., "Cmd+K")
}

/**
 * Error state for consistent error handling
 */
export interface AppError {
  category: "network" | "auth" | "backend" | "validation" | "unknown";
  message: string; // User-friendly error message
  suggestion?: string; // Actionable suggestion for user
  retryable: boolean; // Whether error can be retried
  timestamp: Date; // When error occurred
}
