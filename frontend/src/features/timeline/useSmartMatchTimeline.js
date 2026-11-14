import { useCallback, useEffect, useRef, useState } from 'react';
import { listTimelineEvents } from './api.js';
import {
  TIMELINE_FILTERS,
  compareTimelineEvents,
  matchesFilter,
  removeTimelineEvent,
  upsertTimelineEvent
} from './timelineOrder.js';

export function useSmartMatchTimeline(apiClient, matchId, matchSocket) {
  const [events, setEvents] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState(TIMELINE_FILTERS.ALL);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const isMountedRef = useRef(true);

  // Initial fetch from REST
  useEffect(() => {
    isMountedRef.current = true;
    if (!apiClient || !matchId) return;

    setIsLoading(true);
    setError(null);

    listTimelineEvents(apiClient, matchId, { limit: 25 })
      .then((res) => {
        if (!isMountedRef.current) return;
        const sorted = [...res.events].sort(compareTimelineEvents);
        setEvents(sorted);
        setNextCursor(res.nextCursor);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMountedRef.current) return;
        setError(err);
        setIsLoading(false);
      });

    return () => {
      isMountedRef.current = false;
    };
  }, [apiClient, matchId]);

  // Socket.IO realtime reconciliation
  useEffect(() => {
    if (!matchSocket || isLoading) return;

    function handleCreated(event) {
      setEvents((prev) => upsertTimelineEvent(prev, event));
    }

    function handleUpdated(event) {
      setEvents((prev) => upsertTimelineEvent(prev, event));
    }

    function handleDeleted(event) {
      setEvents((prev) => removeTimelineEvent(prev, event));
    }

    matchSocket.on('timeline_event_created', handleCreated);
    matchSocket.on('timeline_event_updated', handleUpdated);
    matchSocket.on('timeline_event_deleted', handleDeleted);

    return () => {
      matchSocket.off('timeline_event_created', handleCreated);
      matchSocket.off('timeline_event_updated', handleUpdated);
      matchSocket.off('timeline_event_deleted', handleDeleted);
    };
  }, [matchSocket, isLoading]);

  // Cursor-based pagination
  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore || !apiClient || !matchId) return;

    setIsLoadingMore(true);
    try {
      const res = await listTimelineEvents(apiClient, matchId, {
        cursor: nextCursor,
        limit: 25
      });
      if (!isMountedRef.current) return;

      setEvents((prev) => {
        // Merge without duplicating existing IDs
        const existingIds = new Set(prev.map((e) => e.id));
        const newEvents = res.events.filter((e) => !existingIds.has(e.id));
        return [...prev, ...newEvents].sort(compareTimelineEvents);
      });
      setNextCursor(res.nextCursor);
    } catch {
      // Swallowed safely for pagination retry
    } finally {
      if (isMountedRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [apiClient, matchId, nextCursor, isLoadingMore]);

  // Select event for in-app context (never video seek)
  const selectEvent = useCallback((eventId) => {
    setSelectedEventId((prev) => (prev === eventId ? null : eventId));
  }, []);

  const filteredEvents = events.filter((e) => matchesFilter(e, filter));

  return {
    events: filteredEvents,
    allEventsCount: events.length,
    nextCursor,
    hasMore: Boolean(nextCursor),
    isLoading,
    isLoadingMore,
    error,
    filter,
    setFilter,
    selectedEventId,
    selectEvent,
    loadMore
  };
}
