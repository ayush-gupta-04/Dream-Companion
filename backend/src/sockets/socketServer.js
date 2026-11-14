import { Server } from 'socket.io';

export function matchRoom(matchId) {
  return `match:${matchId}`;
}

export function createSocketServer(httpServer, frontendUrl, { authenticate } = {}) {
  const io = new Server(httpServer, {
    cors: { origin: frontendUrl, credentials: true }
  });

  if (authenticate) {
    io.use(async (socket, next) => {
      try {
        socket.data.viewer = await authenticate(socket.handshake.auth?.token);
        next();
      } catch {
        next(new Error('Authentication is required.'));
      }
    });
  }

  io.on('connection', (socket) => {
    socket.on('join_match', (matchId, acknowledge = () => {}) => {
      if (typeof matchId !== 'string' || matchId.length === 0) {
        acknowledge({ ok: false, error: 'A match ID is required.' });
        return;
      }

      socket.join(matchRoom(matchId));
      acknowledge({ ok: true });
    });
  });

  return io;
}

export function publishDeliveryUpdate(io, matchId, action, delivery, state) {
  const room = io.to(matchRoom(matchId));
  const payload = {
    id: delivery.id,
    inningsId: delivery.inningsId,
    deliverySequence: delivery.deliverySequence,
    display: { overNumber: delivery.displayOver, ballLabel: delivery.displayBallLabel },
    runs: { batter: delivery.batterRuns, extras: delivery.totalExtras, total: delivery.totalRuns },
    isLegalDelivery: delivery.isLegalDelivery,
    occurredAt: delivery.occurredAt
  };
  if (action === 'created') {
    room.emit('delivery_added', payload);
  } else if (action === 'corrected') {
    room.emit('delivery_corrected', payload);
  }
  room.emit('score_updated', state);
}

export function publishMatchStatus(io, matchId, status) {
  io.to(matchRoom(matchId)).emit('match_status_updated', { matchId, status });
}

/** Publishes reconciliation changes without altering existing delivery events. */
export function publishTimelineChanges(io, changes) {
  for (const event of changes.created) {
    io.to(matchRoom(event.matchId)).emit('timeline_event_created', event);
  }
  for (const event of changes.updated) {
    io.to(matchRoom(event.matchId)).emit('timeline_event_updated', event);
  }
  for (const event of changes.deleted) {
    io.to(matchRoom(event.matchId)).emit('timeline_event_deleted', event);
  }
}
