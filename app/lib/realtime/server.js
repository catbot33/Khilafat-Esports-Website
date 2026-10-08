import "server-only";

function getIo() {
  return globalThis.__khilafatSocketIo || null;
}

export function emitInvitationEvent(event, payload) {
  getIo()?.to("invitations").emit(event, payload);
}

export function emitUserEvent(userIds, event, payload) {
  const rooms = [...new Set(userIds.filter(Boolean))].map((userId) => `user:${userId}`);
  if (rooms.length === 0) return;

  getIo()?.to(rooms).emit(event, payload);
}

