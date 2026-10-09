import { useState, useRef, useEffect } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  draft?: string; // initial value from storage
  onDraftChange?: (text: string) => void; // called on every keystroke
}

export default function ChatInput({
  onSend,
  disabled,
  draft,
  onDraftChange,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // On mount: restore draft if present and input is empty
  useEffect(() => {
    if (draft && !input) {
      setInput(draft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [input]);

  const updateInput = (value: string) => {
    setInput(value);
    onDraftChange?.(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      updateInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="input-form">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => updateInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about budgets, investments, insurance planning..."
        disabled={disabled}
        rows={1}
        aria-label="Message input"
      />
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        className="send-btn"
        aria-label="Send message"
      >
        ↑
      </button>
    </form>
  );
}
