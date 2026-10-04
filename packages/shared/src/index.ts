import { z } from "zod";

/**
 * The wire contract between apps/api and apps/web.
 *
 * This file is the whole reason this repo is a monorepo: both sides import
 * these names, so renaming an event here breaks `pnpm typecheck` on the
 * client AND the server in the same run, instead of at 2am in production.
 */

export const MAX_MESSAGE_LENGTH = 500;
export const MAX_NICKNAME_LENGTH = 24;
export const DEFAULT_ROOM = "general";

/** How many recent messages a joining client is backfilled with. */
export const HISTORY_LIMIT = 50;

export const nicknameSchema = z
  .string()
  .trim()
  .min(1, "nickname is required")
  .max(MAX_NICKNAME_LENGTH);

export const roomSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9-]+$/, "rooms are lowercase letters, numbers and dashes");

export const chatMessageSchema = z.object({
  id: z.string(),
  room: roomSchema,
  nickname: nicknameSchema,
  body: z.string().min(1).max(MAX_MESSAGE_LENGTH),
  /** Epoch millis. Serialises cleanly over JSON, unlike Date. */
  sentAt: z.number().int().positive(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

/** Payload the client sends to join a room. */
export const joinPayloadSchema = z.object({
  room: roomSchema,
  nickname: nicknameSchema,
});

export type JoinPayload = z.infer<typeof joinPayloadSchema>;

/** Payload the client sends to post a message. */
export const sendPayloadSchema = z.object({
  body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

export type SendPayload = z.infer<typeof sendPayloadSchema>;

/** Sent to a client right after it joins, so it has context. */
export interface RoomSnapshot {
  room: string;
  history: ChatMessage[];
  members: string[];
}

/** Events the server emits to clients. */
export interface ServerToClientEvents {
  "room:snapshot": (snapshot: RoomSnapshot) => void;
  "room:members": (members: string[]) => void;
  "message:new": (message: ChatMessage) => void;
  "server:error": (error: { message: string }) => void;
}

/** Events clients emit to the server. */
export interface ClientToServerEvents {
  "room:join": (payload: JoinPayload) => void;
  "message:send": (payload: SendPayload) => void;
}
