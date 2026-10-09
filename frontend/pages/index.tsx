import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Head from "next/head";
import ChatInput from "../src/components/ChatInput";
import ChatMessage from "../src/components/ChatMessage";
import LoginForm from "../src/components/LoginForm";
import Sidebar from "../src/components/Sidebar";
import CommandPalette from "../src/components/CommandPalette";
import HelpOverlay from "../src/components/HelpOverlay";
import MessageSearch from "../src/components/MessageSearch";
import { signIn, signOut, getCurrentSession, AuthTokens } from "../src/lib/auth";
import { sendMessage, generateSessionId } from "../src/lib/agent";
import { useConversations } from "../src/hooks/useConversations";
import { useTheme } from "../src/hooks/useTheme";
import { useDrafts } from "../src/hooks/useDrafts";
import { useGlobalShortcuts } from "../src/hooks/useKeyboardShortcuts";
import { Conversation, CommandPaletteItem } from "../src/types";

const SUGGESTIONS = [
  "Create a monthly budget for $6,000 income",
  "Analyze AAPL and MSFT stock performance",
  "Build a conservative portfolio for $25K",
  "Compare NVDA, TSLA, and META over 6 months",
  "What's the 50/30/20 rule for budgeting?",
  "How should I allocate savings for insurance premiums?",
];

/** Truncate text to maxLen chars, breaking at the last word boundary */
function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
}

/** Generate a unique ID */
function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export default function Home() {
  // ── Auth ─────────────────────────────────────────────────────────
  const [auth, setAuth] = useState<AuthTokens | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Per-session AgentCore session ID
  const [sessionId] = useState(generateSessionId);

  // ── Streaming state ───────────────────────────────────────────────
  const [isStreaming, setIsStreaming] = useState(false);

  // ── Sidebar mobile toggle ─────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Conversation management ───────────────────────────────────────
  const {
    conversations,
    currentConversationId,
    currentConversation,
    addConversation,
    updateConversation,
    updateLastAssistantMessage,
    deleteConversation,
    pinConversation,
    setCurrentConversationId,
  } = useConversations();

  // ── Theme ─────────────────────────────────────────────────────────
  const { theme, toggleTheme } = useTheme();

  // ── New state ─────────────────────────────────────────────────────
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showHelpOverlay, setShowHelpOverlay] = useState(false);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [hasUnsavedEdit, setHasUnsavedEdit] = useState(false);
  const [msgSearchTerm, setMsgSearchTerm] = useState("");
  const [msgSearchCurrent, setMsgSearchCurrent] = useState(0); // 1-based
  const [sendError, setSendError] = useState<{
    message: string;
    attempt: number;
    maxAttempts: number;
  } | null>(null);
  const lastSentContentRef = useRef<string>("");

  // ── Drafts ────────────────────────────────────────────────────────
  const { getDraft, setDraft, clearDraft } = useDrafts();
  const draftKey = currentConversationId ?? "new";

  // ── Derive the messages shown in the chat area ────────────────────
  const messages = (currentConversation?.messages ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
    isEdited: m.isEdited,
    editedAt: m.editedAt,
  }));

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Message search ────────────────────────────────────────────────
  const msgSearchMatches = useMemo(() => {
    if (!msgSearchTerm.trim()) return [];
    const term = msgSearchTerm.toLowerCase();
    return messages
      .filter((m) => m.content.toLowerCase().includes(term))
      .map((m) => m.id);
  }, [messages, msgSearchTerm]);

  const msgSearchCount = msgSearchMatches.length;
  const currentMatchId =
    msgSearchCount > 0
      ? msgSearchMatches[
          ((msgSearchCurrent - 1 + msgSearchCount) % msgSearchCount)
        ]
      : null;

  const handleSearchPrev = useCallback(() => {
    setMsgSearchCurrent((prev) =>
      msgSearchCount === 0
        ? 0
        : ((prev - 2 + msgSearchCount) % msgSearchCount) + 1
    );
  }, [msgSearchCount]);

  const handleSearchNext = useCallback(() => {
    setMsgSearchCurrent((prev) =>
      msgSearchCount === 0 ? 0 : (prev % msgSearchCount) + 1
    );
  }, [msgSearchCount]);

  // Scroll to current match when it changes
  useEffect(() => {
    if (!currentMatchId) return;
    document.getElementById(`msg-${currentMatchId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [currentMatchId]);

  // Reset current match when search term changes
  useEffect(() => {
    setMsgSearchCurrent(msgSearchCount > 0 ? 1 : 0);
  }, [msgSearchTerm, msgSearchCount]);

  const handleCloseSearch = useCallback(() => {
    setShowMessageSearch(false);
    setMsgSearchTerm("");
  }, []);

  // ── Auth lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    getCurrentSession().then((session) => {
      if (session) setAuth(session);
      setAuthChecked(true);
    });
  }, []);

  const handleLogin = async (username: string, password: string) => {
    setAuthError(null);
    try {
      const tokens = await signIn(username, password);
      setAuth(tokens);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed");
    }
  };

  const handleLogout = () => {
    signOut();
    setAuth(null);
    setCurrentConversationId(null);
  };

  // ── Conversation actions ──────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    setCurrentConversationId(null);
  }, [setCurrentConversationId]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      if (
        hasUnsavedEdit &&
        !window.confirm("You have unsaved changes. Leave anyway?")
      )
        return;
      setHasUnsavedEdit(false);
      setCurrentConversationId(id);
      setSidebarOpen(false);
    },
    [hasUnsavedEdit, setCurrentConversationId]
  );

  const handleDeleteConversation = useCallback(
    (id: string) => {
      deleteConversation(id);
    },
    [deleteConversation]
  );

  const handleRenameConversation = useCallback(
    (id: string, newTitle: string) => {
      updateConversation(id, { title: newTitle });
    },
    [updateConversation]
  );

  const handlePinConversation = useCallback(
    (id: string) => {
      pinConversation(id);
    },
    [pinConversation]
  );

  /** Export — triggers file download (PDF opens print dialog) */
  const handleExportConversation = useCallback(
    (id: string, format: "pdf" | "markdown" | "csv") => {
      const conv = conversations.find((c) => c.id === id);
      if (!conv) return;

      if (format === "pdf") {
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(
            `<html><head><title>${conv.title}</title></head><body>` +
              `<h1>${conv.title}</h1>` +
              conv.messages
                .map(
                  (m) =>
                    `<p><strong>${
                      m.role === "user" ? "You" : "Advisor"
                    }:</strong> ${m.content}</p>`
                )
                .join("") +
              `</body></html>`
          );
          win.document.close();
          win.print();
        }
        return;
      }

      let content = "";
      let mimeType = "text/plain";
      let fileName = `${conv.title}.txt`;

      if (format === "markdown") {
        content = `# ${conv.title}\n\n`;
        content += conv.messages
          .map(
            (m) =>
              `**${m.role === "user" ? "You" : "Advisor"}**: ${m.content}`
          )
          .join("\n\n");
        mimeType = "text/markdown";
        fileName = `${conv.title}.md`;
      } else {
        // csv
        content = "role,content,timestamp\n";
        content += conv.messages
          .map(
            (m) =>
              `"${m.role}","${m.content.replace(/"/g, '""')}","${m.timestamp.toISOString()}"`
          )
          .join("\n");
        mimeType = "text/csv";
        fileName = `${conv.title}.csv`;
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    },
    [conversations]
  );

  // ── Message edit / delete ─────────────────────────────────────────
  const handleEditMessage = useCallback(
    (messageId: string, newContent: string) => {
      if (!currentConversationId) return;
      updateConversation(currentConversationId, {
        messages: currentConversation!.messages.map((m) =>
          m.id === messageId
            ? { ...m, content: newContent, isEdited: true, editedAt: new Date() }
            : m
        ),
      });
    },
    [currentConversationId, currentConversation, updateConversation]
  );

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      if (!currentConversationId) return;
      updateConversation(currentConversationId, {
        messages: currentConversation!.messages.filter(
          (m) => m.id !== messageId
        ),
      });
    },
    [currentConversationId, currentConversation, updateConversation]
  );

  // ── Send message ──────────────────────────────────────────────────
  const handleSend = useCallback(
    (content: string) => {
      if (!auth) return;

      const now = new Date();
      const userMsgId = newId();
      const assistantMsgId = newId() + "a";

      // Create a new conversation if none is active
      let convId = currentConversationId;
      if (!convId) {
        convId = newId();
        const title = truncateAtWord(content, 50) || "New conversation";
        const newConv: Conversation = {
          id: convId,
          title,
          createdAt: now,
          updatedAt: now,
          messages: [],
          isPinned: false,
        };
        addConversation(newConv);
        setCurrentConversationId(convId);
      }

      const capturedConvId = convId;

      // Capture the current messages for the existing conversation
      const existingMessages =
        conversations.find((c) => c.id === capturedConvId)?.messages ?? [];

      // Add user + empty assistant messages to the conversation
      updateConversation(capturedConvId, {
        updatedAt: now,
        messages: [
          ...existingMessages,
          {
            id: userMsgId,
            role: "user" as const,
            content,
            timestamp: now,
          },
          {
            id: assistantMsgId,
            role: "assistant" as const,
            content: "",
            timestamp: new Date(),
          },
        ],
      });

      setIsStreaming(true);
      setSendError(null);
      lastSentContentRef.current = content;

      let attemptCount = 0;
      const MAX_ATTEMPTS = 3;

      const attemptSend = () => {
        attemptCount += 1;
        sendMessage(
          content,
          auth.accessToken,
          sessionId,
          "default_user",
          (chunk) => {
            updateLastAssistantMessage(capturedConvId, chunk);
          },
          () => {
            setIsStreaming(false);
            setSendError(null);
            clearDraft(draftKey);
          },
          (error) => {
            if (attemptCount >= MAX_ATTEMPTS) {
              setIsStreaming(false);
              setSendError({
                message: error,
                attempt: attemptCount,
                maxAttempts: MAX_ATTEMPTS,
              });
              updateLastAssistantMessage(capturedConvId, `❌ ${error}`);
            } else {
              setSendError({
                message: error,
                attempt: attemptCount,
                maxAttempts: MAX_ATTEMPTS,
              });
              attemptSend();
            }
          }
        );
      };

      attemptSend();
    },
    [
      auth,
      sessionId,
      currentConversationId,
      conversations,
      addConversation,
      updateConversation,
      updateLastAssistantMessage,
      setCurrentConversationId,
      clearDraft,
      draftKey,
    ]
  );

  // ── Retry handler ─────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    if (!lastSentContentRef.current || !auth) return;
    setSendError(null);
    handleSend(lastSentContentRef.current);
  }, [auth, handleSend]);

  // ── Command palette items ─────────────────────────────────────────
  const paletteCommands: CommandPaletteItem[] = [
    {
      id: "new-chat",
      title: "New Chat",
      description: "Start a new conversation",
      category: "navigation",
      shortcut: "Cmd+N",
      action: () => {
        if (
          hasUnsavedEdit &&
          !window.confirm("You have unsaved changes. Leave anyway?")
        )
          return;
        setHasUnsavedEdit(false);
        handleNewChat();
      },
    },
    {
      id: "search",
      title: "Search Messages",
      description: "Find text in current conversation",
      category: "navigation",
      shortcut: "Cmd+F",
      action: () => setShowMessageSearch(true),
    },
    {
      id: "toggle-theme",
      title: theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode",
      description: "Toggle light / dark theme",
      category: "theme",
      shortcut: "",
      action: toggleTheme,
    },
    {
      id: "help",
      title: "Keyboard Shortcuts",
      description: "Show all keyboard shortcuts",
      category: "navigation",
      shortcut: "Cmd+/",
      action: () => setShowHelpOverlay(true),
    },
  ];

  // ── Keyboard shortcuts ────────────────────────────────────────────
  useGlobalShortcuts({
    onCmdK: () => setShowCommandPalette(true),
    onCmdSlash: () => setShowHelpOverlay(true),
    onCmdN: () => {
      if (
        hasUnsavedEdit &&
        !window.confirm("You have unsaved changes. Leave anyway?")
      )
        return;
      setHasUnsavedEdit(false);
      handleNewChat();
    },
    onCmdF: () => setShowMessageSearch(true),
    onEscape: () => {
      setShowCommandPalette(false);
      setShowHelpOverlay(false);
      handleCloseSearch();
    },
  });

  // ── Render guards ─────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="loading">
        <p>Loading...</p>
      </div>
    );
  }

  if (!auth) {
    return (
      <>
        <Head>
          <title>Sign In — ERGO NEXT Financial Advisor</title>
        </Head>
        <LoginForm onLogin={handleLogin} error={authError} />
      </>
    );
  }

  // ── Main app ──────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>Financial Advisor — ERGO NEXT Insurance</title>
      </Head>

      {/* Skip to main content — accessibility */}
      <a href="#main-chat" className="skip-link">
        Skip to main content
      </a>

      <div className="app-wrapper">
        {/* ── Header — full width ── */}
        <header className="header">
          <div className="header-brand">
            {/* Hamburger — mobile only (hidden via CSS on desktop) */}
            <button
              className="hamburger-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open conversations sidebar"
              aria-expanded={sidebarOpen}
            >
              ☰
            </button>

            <div className="header-logo-wordmark">
              <div className="ergo-next-logo" aria-label="ERGO NEXT Insurance">
                <span className="logo-ergo">ERGO</span>
                <span className="logo-divider" aria-hidden="true">|</span>
                <span className="logo-next">NEXT</span>
              </div>
              <p style={{ fontSize: "0.72rem", color: "var(--text-light)", marginTop: "2px", letterSpacing: "0.02em" }}>
                Financial Advisor &bull; AI-Powered
              </p>
            </div>
          </div>

          <div className="header-actions">
            {/* Theme toggle */}
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label={
                theme === "light"
                  ? "Switch to dark mode"
                  : "Switch to light mode"
              }
              title={theme === "light" ? "Dark mode" : "Light mode"}
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>

            <button onClick={handleLogout} className="signout-btn">
              Sign Out
            </button>
          </div>
        </header>

        {/* ── Body — sidebar + chat column ── */}
        <div className="app-body">
          <Sidebar
            conversations={conversations}
            currentConversationId={currentConversationId}
            onSelect={handleSelectConversation}
            onNewChat={handleNewChat}
            onDelete={handleDeleteConversation}
            onRename={handleRenameConversation}
            onPin={handlePinConversation}
            onExport={handleExportConversation}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          {/* Chat column */}
          <div className="chat-column">
            {/* Message search bar — rendered above main */}
            <MessageSearch
              isOpen={showMessageSearch}
              onClose={handleCloseSearch}
              searchTerm={msgSearchTerm}
              onSearchChange={(term) => setMsgSearchTerm(term)}
              matchCount={msgSearchCount}
              currentMatch={msgSearchCurrent}
              onPrevMatch={handleSearchPrev}
              onNextMatch={handleSearchNext}
            />

            <main id="main-chat" className="chat-area">
              {messages.length === 0 && (
                <div className="empty-state">
                  <h2>How can I help with your finances today?</h2>
                  <p>
                    Get personalized budget advice, investment portfolio
                    recommendations, stock analysis, and insurance planning
                    guidance.
                  </p>
                  <div className="suggestions">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => handleSend(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onEdit={handleEditMessage}
                  onDelete={handleDeleteMessage}
                  onEditStart={() => setHasUnsavedEdit(true)}
                  onEditEnd={() => setHasUnsavedEdit(false)}
                  isStreaming={isStreaming}
                  searchTerm={showMessageSearch ? msgSearchTerm : ""}
                />
              ))}

              {isStreaming && (
                <div
                  role="status"
                  aria-live="polite"
                  aria-label="Assistant is responding"
                  className="streaming"
                >
                  <div className="dots">...</div>
                  Analyzing...
                </div>
              )}

              <div ref={chatEndRef} />
            </main>

            <div className="input-area">
              <ChatInput
                onSend={handleSend}
                disabled={isStreaming}
                draft={getDraft(draftKey)}
                onDraftChange={(text) => setDraft(draftKey, text)}
              />
            </div>

            {/* Retry / error banner */}
            {sendError && (
              <div className="send-error-banner" role="alert">
                <span className="send-error-msg">
                  ❌ Failed to send message {sendError.attempt}/
                  {sendError.maxAttempts}
                  {sendError.attempt >= sendError.maxAttempts &&
                    " — check your internet connection"}
                </span>
                {sendError.attempt < sendError.maxAttempts && (
                  <button
                    className="retry-btn"
                    onClick={handleRetry}
                    aria-label="Retry sending message"
                  >
                    Retry
                  </button>
                )}
                <button
                  className="dismiss-error-btn"
                  onClick={() => setSendError(null)}
                  aria-label="Dismiss error"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="footer-brand">
              <a
                href="https://www.ergo.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: 700, color: "#C8102E" }}
              >
                ERGO | NEXT
              </a>
              {" "}&bull; AI-Powered Financial Intelligence
              <div className="powered-by">Powered by CloudAge</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Global overlays ── */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        commands={paletteCommands}
      />
      <HelpOverlay
        isOpen={showHelpOverlay}
        onClose={() => setShowHelpOverlay(false)}
      />
    </>
  );
}
