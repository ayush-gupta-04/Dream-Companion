/**
 * Compares two timeline events deterministically.
 *
 * Ordered by:
 * 1. Innings number (ascending)
 * 2. Delivery sequence within innings (ascending)
 * 3. Event order / ID (ascending)
 *
 * Never relies on packet arrival time for ordering.
 */
export function compareTimelineEvents(a, b) {
  const inningsA = a?.innings?.number ?? 0;
  const inningsB = b?.innings?.number ?? 0;
  if (inningsA !== inningsB) return inningsA - inningsB;

  const seqA = a?.delivery?.sequence ?? 0;
  const seqB = b?.delivery?.sequence ?? 0;
  if (seqA !== seqB) return seqA - seqB;

  const orderA = a?.eventOrder ?? 0;
  const orderB = b?.eventOrder ?? 0;
  if (orderA !== orderB) return orderA - orderB;

  const idA = a?.id ?? '';
  const idB = b?.id ?? '';
  return idA.localeCompare(idB);
}

/**
 * Reconciles an inserted or updated timeline event safely without duplicates.
 */
export function upsertTimelineEvent(existingEvents, eventToUpsert) {
  if (!eventToUpsert?.id) return existingEvents;

  const existingIndex = existingEvents.findIndex((e) => e.id === eventToUpsert.id);
  let updatedList;

  if (existingIndex !== -1) {
    // In-place update
    updatedList = [...existingEvents];
    updatedList[existingIndex] = eventToUpsert;
  } else {
    // New event insertion
    updatedList = [...existingEvents, eventToUpsert];
  }

  return updatedList.sort(compareTimelineEvents);
}

/**
 * Removes an event safely by ID (e.g. on provider correction).
 */
export function removeTimelineEvent(existingEvents, eventToRemove) {
  const targetId = typeof eventToRemove === 'string' ? eventToRemove : eventToRemove?.id;
  if (!targetId) return existingEvents;

  return existingEvents.filter((e) => e.id !== targetId);
}

export const TIMELINE_FILTERS = {
  ALL: 'ALL',
  WICKETS: 'WICKETS',
  BOUNDARIES: 'BOUNDARIES',
  MILESTONES: 'MILESTONES'
};

export function matchesFilter(event, filter) {
  if (!event) return false;
  if (!filter || filter === TIMELINE_FILTERS.ALL) return true;

  if (filter === TIMELINE_FILTERS.WICKETS) {
    return event.type === 'WICKET';
  }

  if (filter === TIMELINE_FILTERS.BOUNDARIES) {
    return event.type === 'FOUR' || event.type === 'SIX';
  }

  if (filter === TIMELINE_FILTERS.MILESTONES) {
    return event.type === 'BATTER_MILESTONE' || event.type === 'PARTNERSHIP_MILESTONE';
  }

  return true;
}
