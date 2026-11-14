import { TimelineEventCard } from './TimelineEventCard.jsx';
import { TimelineSkeleton } from './TimelineSkeleton.jsx';
import { TIMELINE_FILTERS } from './timelineOrder.js';
import { useSmartMatchTimeline } from './useSmartMatchTimeline.js';

export function SmartMatchTimeline({
  apiClient,
  matchId,
  matchSocket,
  isLive = false,
  isSocketConnected = false
}) {
  const {
    events,
    allEventsCount,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    filter,
    setFilter,
    selectedEventId,
    selectEvent,
    loadMore
  } = useSmartMatchTimeline(apiClient, matchId, matchSocket);

  return (
    <section className="smart-timeline-container" aria-label="Smart match timeline">
      <header className="timeline-header">
        <div className="timeline-header-title-row">
          <div>
            <span className="eyebrow">Match story</span>
            <h3 className="timeline-title">Smart Timeline</h3>
          </div>

          <div className="timeline-sync-badge">
            <span
              className={`status-dot ${isSocketConnected ? 'status-dot--live' : ''}`}
              aria-hidden="true"
            />
            <span>{isSocketConnected ? 'Live sync' : isLive ? 'Connecting…' : 'Archived'}</span>
          </div>
        </div>

        <nav className="timeline-filter-bar" aria-label="Filter timeline events">
          <button
            type="button"
            className={`filter-pill ${filter === TIMELINE_FILTERS.ALL ? 'filter-pill--active' : ''}`}
            onClick={() => setFilter(TIMELINE_FILTERS.ALL)}
          >
            All ({allEventsCount})
          </button>
          <button
            type="button"
            className={`filter-pill ${filter === TIMELINE_FILTERS.WICKETS ? 'filter-pill--active' : ''}`}
            onClick={() => setFilter(TIMELINE_FILTERS.WICKETS)}
          >
            Wickets
          </button>
          <button
            type="button"
            className={`filter-pill ${filter === TIMELINE_FILTERS.BOUNDARIES ? 'filter-pill--active' : ''}`}
            onClick={() => setFilter(TIMELINE_FILTERS.BOUNDARIES)}
          >
            Boundaries
          </button>
          <button
            type="button"
            className={`filter-pill ${filter === TIMELINE_FILTERS.MILESTONES ? 'filter-pill--active' : ''}`}
            onClick={() => setFilter(TIMELINE_FILTERS.MILESTONES)}
          >
            Milestones
          </button>
        </nav>
      </header>

      {isLoading ? (
        <TimelineSkeleton />
      ) : error ? (
        <div className="timeline-error-note">
          <p>Unable to load timeline moments.</p>
        </div>
      ) : events.length === 0 ? (
        <div className="timeline-empty-card">
          <p className="timeline-empty-title">No key moments recorded yet.</p>
          <p className="timeline-empty-desc">
            Wickets, boundaries, milestones, and rate shifts will appear here as the match progresses.
          </p>
        </div>
      ) : (
        <div
          className="timeline-events-scroll"
          role="region"
          aria-live="polite"
          aria-label="Match events list"
        >
          <div className="timeline-events-feed">
            {events.map((event) => (
              <TimelineEventCard
                key={event.id}
                event={event}
                isSelected={selectedEventId === event.id}
                onSelect={selectEvent}
              />
            ))}
          </div>

          {hasMore && (
            <div className="timeline-pagination">
              <button
                type="button"
                className="button button-secondary pagination-button"
                onClick={loadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? 'Loading earlier moments…' : 'Load earlier moments'}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
