import { HISTORY_LIMIT, type ChatMessage } from "@chat/shared";

/**
 * In-memory room state.
 *
 * Deliberately not a database: today's lesson is monorepo build + deploy, and
 * a Postgres container would add volumes and migrations to the pipeline. The
 * consequence is real though - restarting the container wipes history, and two
 * replicas would not see each other's messages.
 */
interface Room {
  history: ChatMessage[];
  /** socket id -> nickname */
  members: Map<string, string>;
}

const rooms = new Map<string, Room>();

function getOrCreate(room: string): Room {
  let existing = rooms.get(room);
  if (!existing) {
    existing = { history: [], members: new Map() };
    rooms.set(room, existing);
  }
  return existing;
}

export function join(room: string, socketId: string, nickname: string): void {
  getOrCreate(room).members.set(socketId, nickname);
}

export function leave(room: string, socketId: string): void {
  const existing = rooms.get(room);
  if (!existing) return;
  existing.members.delete(socketId);
  // Drop empty rooms so a long-running process does not leak a Map entry per
  // room name anyone ever typed.
  if (existing.members.size === 0 && existing.history.length === 0) {
    rooms.delete(room);
  }
}

export function append(message: ChatMessage): void {
  const existing = getOrCreate(message.room);
  existing.history.push(message);
  if (existing.history.length > HISTORY_LIMIT) {
    existing.history.splice(0, existing.history.length - HISTORY_LIMIT);
  }
}

export function history(room: string): ChatMessage[] {
  return rooms.get(room)?.history ?? [];
}

export function members(room: string): string[] {
  return [...(rooms.get(room)?.members.values() ?? [])];
}
