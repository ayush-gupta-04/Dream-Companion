function formatTypeLabel(type) {
  switch (type) {
    case 'WICKET':
      return 'Wicket';
    case 'FOUR':
      return 'Four';
    case 'SIX':
      return 'Six';
    case 'BATTER_MILESTONE':
      return 'Milestone';
    case 'PARTNERSHIP_MILESTONE':
      return 'Partnership';
    case 'MAIDEN_OVER':
      return 'Maiden Over';
    case 'EXPENSIVE_OVER':
      return 'Big Over';
    case 'SCORING_RATE_SHIFT':
      return 'Rate Shift';
    default:
      return type;
  }
}

export function TimelineEventCard({ event, isSelected = false, onSelect }) {
  if (!event) return null;

  const { id, type, title, description, importance, delivery, innings } = event;
  const ballLabel = delivery?.display?.ballLabel || `${delivery?.display?.overNumber ?? ''}`;
  const inningsNum = innings?.number;

  function handleClick() {
    if (onSelect) {
      onSelect(id);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }

  return (
    <article
      className={`timeline-event-card timeline-event-card--${type?.toLowerCase()} ${
        isSelected ? 'timeline-event-card--selected' : ''
      }`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      aria-label={`${title}, Over ${ballLabel}. Click to select as in-app question context.`}
    >
      <div className="timeline-card-header">
        <div className="timeline-card-badges">
          <span className={`timeline-type-pill timeline-type-pill--${type?.toLowerCase()}`}>
            {formatTypeLabel(type)}
          </span>
          {importance?.level && (
            <span className={`timeline-importance-pill timeline-importance-pill--${importance.level.toLowerCase()}`}>
              {importance.level}
            </span>
          )}
        </div>

        <div className="timeline-delivery-ref font-tabular">
          {inningsNum ? `Inn ${inningsNum} • ` : ''}
          {ballLabel ? `Ov ${ballLabel}` : ''}
        </div>
      </div>

      <div className="timeline-card-body">
        <h4 className="timeline-card-title">{title}</h4>
        <p className="timeline-card-desc">{description}</p>
      </div>

      <div className="timeline-card-footer">
        <span className="timeline-context-hint">
          {isSelected ? '✓ Context selected for companion' : 'Select for question context'}
        </span>
      </div>
    </article>
  );
}
