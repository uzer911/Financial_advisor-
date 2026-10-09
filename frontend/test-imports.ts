// Test that all hooks and types export correctly
import { useConversations, useTheme, useDrafts, useKeyboardShortcuts, useGlobalShortcuts } from './src/hooks';
import type { Conversation, Message, ThemeState, Draft, CommandPaletteItem, AppError } from './src/types';

// Verify types are exported
const conv: Conversation = {
  id: 'test',
  title: 'Test',
  createdAt: new Date(),
  updatedAt: new Date(),
  messages: [],
};

const msg: Message = {
  id: 'msg',
  role: 'user',
  content: 'test',
  timestamp: new Date(),
};

const theme: ThemeState = {
  mode: 'light',
  systemPreference: false,
};

console.log('All imports successful!');
