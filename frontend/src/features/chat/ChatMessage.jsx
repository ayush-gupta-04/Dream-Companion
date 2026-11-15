import ReactMarkdown from 'react-markdown';

function formatReference(ref) {
  if (!ref) return null;
  if (ref.ballLabel) return `Ov ${ref.ballLabel}`;
  if (ref.overNumber !== undefined && ref.overNumber !== null) return `Over ${ref.overNumber}`;
  if (ref.deliverySequence) return `Ball #${ref.deliverySequence}`;
  if (ref.type) return ref.type;
  return 'Match moment';
}

export function ChatMessage({ message }) {
  if (!message) return null;

  if (message.sender === 'user') {
    return (
      <div className="chat-message chat-message--user" role="listitem">
        <div className="chat-bubble chat-bubble--user">
          <p className="chat-text">{message.text}</p>
        </div>
      </div>
    );
  }

  // Assistant message
  const { status, result, error } = message;

  return (
    <div className="chat-message chat-message--assistant" role="listitem">
      <div className="chat-bubble chat-bubble--assistant">
        {status === 'loading' && (
          <div className="chat-typing-indicator" aria-label="Thinking…">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        )}

        {status === 'error' && (
          <div className="chat-error-card">
            {error?.status === 422 ? (
              <p className="chat-error-message">
                <strong>Session marker required:</strong> Join the match before asking what you missed.
              </p>
            ) : error?.status === 503 ? (
              <p className="chat-error-message">
                <strong>AI Unavailable:</strong> The match intelligence query service is temporarily unavailable.
              </p>
            ) : (
              <p className="chat-error-message">
                <strong>Query failed:</strong> {error?.message || 'Unable to process query.'}
              </p>
            )}
          </div>
        )}

        {status === 'success' && result && (
          <article className={`chat-response-card chat-response-card--${result.kind?.toLowerCase()}`}>
            <header className="chat-response-header">
              <span className={`chat-kind-badge chat-kind-badge--${result.kind?.toLowerCase()}`}>
                {result.kind === 'ANALYSIS'
                  ? 'Match Analysis'
                  : result.kind === 'RECAP'
                    ? 'Match Recap'
                    : 'Query Notice'}
              </span>
            </header>

            {/* Model narrative: rendered as pure markdown */}
            {typeof result.answer === 'string' && (
              <div className="chat-response-markdown">
                <ReactMarkdown>{result.answer}</ReactMarkdown>
              </div>
            )}

            {/* Factual references separated from model narrative */}
            {Array.isArray(result.references) && result.references.length > 0 && (
              <div className="chat-references-section" aria-label="Referenced match events">
                <span className="chat-references-label">Verified references:</span>
                <div className="chat-references-chips">
                  {result.references.map((ref, idx) => (
                    <span key={idx} className="chat-reference-chip font-tabular">
                      {formatReference(ref)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Limitations or unsupported explanation */}
            {Array.isArray(result.limitations) && result.limitations.length > 0 && (
              <div className="chat-limitations-box">
                {result.limitations.map((limitation, idx) => (
                  <p key={idx} className="chat-limitation-text">
                    {limitation}
                  </p>
                ))}
              </div>
            )}
          </article>
        )}
      </div>
    </div>
  );
}
