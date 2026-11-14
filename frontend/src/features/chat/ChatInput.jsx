import { useState } from 'react';

export function ChatInput({ onSubmit, disabled = false, isSubmitting = false }) {
  const [input, setInput] = useState('');

  const trimmed = input.trim();
  const isValidLength = trimmed.length >= 3 && trimmed.length <= 500;
  const canSubmit = isValidLength && !disabled && !isSubmitting;

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    onSubmit(trimmed);
    setInput('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) {
        handleSubmit(e);
      }
    }
  }

  return (
    <form className="chat-input-form" onSubmit={handleSubmit} aria-label="Ask the Match query form">
      <div className="chat-input-wrapper">
        <input
          type="text"
          className="chat-input-field"
          placeholder="Ask about an over, player, or moment…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isSubmitting}
          maxLength={500}
          aria-label="Natural language match question"
        />

        <button
          type="submit"
          className="chat-submit-button"
          disabled={!canSubmit}
          aria-label={isSubmitting ? 'Submitting query…' : 'Send query'}
        >
          {isSubmitting ? (
            <span className="spinner-mini" aria-hidden="true" />
          ) : (
            <span aria-hidden="true">↑</span>
          )}
        </button>
      </div>

      {input.length > 0 && input.length < 3 && (
        <span className="chat-input-hint">Type at least 3 characters.</span>
      )}
    </form>
  );
}
