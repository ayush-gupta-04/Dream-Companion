import { useEffect, useRef, useState } from 'react';
import { ChatInput } from './ChatInput.jsx';
import { ChatMessage } from './ChatMessage.jsx';
import { ChatPromptButtons } from './ChatPromptButtons.jsx';
import { useMatchChat } from './useMatchChat.js';

export function MatchCompanionChat({
  apiClient,
  matchId,
  sessionId,
  defaultOpen = false
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { messages, isSubmitting, submitQuery, clearChat } = useMatchChat(
    apiClient,
    matchId,
    sessionId
  );

  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSubmitting, isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div className="chatbot-widget-container">
      {isOpen && (
        <section
          className="companion-chat-card chatbot-card-floating"
          aria-label="Live Match Companion Chat"
          role="dialog"
          aria-modal="false"
        >
          <div className="chat-card-accent-bar" aria-hidden="true" />
          <header className="chat-card-header">
            <h3 className="chat-card-title">Dream Companion</h3>

            <div className="chat-header-actions">
              {messages.length > 0 && (
                <button
                  type="button"
                  className="text-button chat-clear-button"
                  onClick={clearChat}
                  disabled={isSubmitting}
                >
                  Clear transcript
                </button>
              )}

              <button
                type="button"
                className="chat-collapse-button"
                onClick={() => setIsOpen(false)}
                aria-label="Collapse Dream Companion"
                title="Collapse chat"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </header>

          {/* Ordered conversation transcript / Initial centered quick prompts */}
          <div
            className="chat-transcript-area"
            role="log"
            aria-live="polite"
            aria-label="Conversation transcript"
          >
            {messages.length === 0 ? (
              <div className="chat-empty-state-centered">
                <ChatPromptButtons onSelectPrompt={submitQuery} disabled={isSubmitting} />
              </div>
            ) : (
              <div className="chat-messages-list" role="list">
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Free-text input */}
          <ChatInput onSubmit={submitQuery} isSubmitting={isSubmitting} />
        </section>
      )}

      {/* Floating circular trigger button with styled DC */}
      <button
        type="button"
        className={`chatbot-launcher-circle ${isOpen ? 'chatbot-launcher-circle--open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? 'Collapse Dream Companion' : 'Open Dream Companion'}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <span className="chatbot-launcher-close-icon" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </span>
        ) : (
          <>
            <span className="chatbot-launcher-dc-text">DC</span>
            <span className="chatbot-status-pulse-dot" aria-hidden="true" />
            <span className="chatbot-launcher-ripple" aria-hidden="true" />
          </>
        )}
      </button>
    </div>
  );
}
