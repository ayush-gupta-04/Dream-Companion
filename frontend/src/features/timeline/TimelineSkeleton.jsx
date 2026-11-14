export function TimelineSkeleton() {
  return (
    <div className="timeline-loading" aria-busy="true" aria-label="Loading match timeline">
      <div className="timeline-skeleton-card">
        <div className="skeleton-pill" style={{ width: '5rem' }} />
        <span className="skeleton-title" style={{ width: '60%', height: '1.25rem' }} />
        <span className="skeleton-row" style={{ width: '90%' }} />
      </div>
      <div className="timeline-skeleton-card">
        <div className="skeleton-pill" style={{ width: '4.5rem' }} />
        <span className="skeleton-title" style={{ width: '50%', height: '1.25rem' }} />
        <span className="skeleton-row" style={{ width: '85%' }} />
      </div>
      <div className="timeline-skeleton-card">
        <div className="skeleton-pill" style={{ width: '6rem' }} />
        <span className="skeleton-title" style={{ width: '70%', height: '1.25rem' }} />
        <span className="skeleton-row" style={{ width: '75%' }} />
      </div>
    </div>
  );
}
