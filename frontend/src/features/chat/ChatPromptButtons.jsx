export const CANONICAL_PROMPTS = [
  'What did I miss since I joined?',
  'Summarize the last over',
  'Summarize the last 10 minutes',
  'Analyse the last over',
  'Analyze the first over'
];

export function ChatPromptButtons({ onSelectPrompt, disabled = false }) {
  return (
    <div className="chat-prompts-container" aria-label="Suggested questions">
      <div className="chat-prompts-list">
        {CANONICAL_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="chat-prompt-pill"
            onClick={() => onSelectPrompt(prompt)}
            disabled={disabled}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
