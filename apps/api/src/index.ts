import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import { Server, type Socket } from "socket.io";
import {
  DEFAULT_ROOM,
  joinPayloadSchema,
  sendPayloadSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "@chat/shared";
import * as rooms from "./rooms";

const PORT = Number(process.env.PORT ?? 4010);

/**
 * In production the browser talks to this server same-origin, through the
 * reverse proxy, so no CORS is needed. In local dev the Vite server on :5173
 * proxies to us, which is also same-origin from the browser's point of view.
 * CORS_ORIGIN exists only as an escape hatch for talking to the API directly.
 */
const CORS_ORIGIN = process.env.CORS_ORIGIN;

/** Per-socket state, so we know which room to clean up on disconnect. */
interface SocketData {
  room: string;
  nickname: string;
}

type ChatSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const app = express();
app.disable("x-powered-by");
if (CORS_ORIGIN) {
  app.use(cors({ origin: CORS_ORIGIN }));
}

/**
 * Liveness endpoint. Used by the Docker HEALTHCHECK and by the deploy step in
 * CI to decide whether the new container actually came up.
 */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

const httpServer = createServer(app);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>(httpServer, {
  path: "/socket.io",
  cors: CORS_ORIGIN ? { origin: CORS_ORIGIN } : undefined,
});

io.on("connection", (socket: ChatSocket) => {
  socket.data.room = "";
  socket.data.nickname = "";

  socket.on("room:join", (payload) => {
    const parsed = joinPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("server:error", {
        message: parsed.error.issues[0]?.message ?? "invalid join payload",
      });
      return;
    }

    const { room, nickname } = parsed.data;

    // A socket lives in exactly one room here, so leaving the previous one
    // keeps the member lists honest when someone switches rooms.
    if (socket.data.room) {
      const previous = socket.data.room;
      socket.leave(previous);
      rooms.leave(previous, socket.id);
      io.to(previous).emit("room:members", rooms.members(previous));
    }

    socket.data.room = room;
    socket.data.nickname = nickname;
    socket.join(room);
    rooms.join(room, socket.id, nickname);

    socket.emit("room:snapshot", {
      room,
      history: rooms.history(room),
      members: rooms.members(room),
    });
    io.to(room).emit("room:members", rooms.members(room));
  });

  socket.on("message:send", (payload) => {
    const room = socket.data.room;
    if (!room) {
      socket.emit("server:error", { message: "join a room first" });
      return;
    }

    const parsed = sendPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("server:error", {
        message: parsed.error.issues[0]?.message ?? "invalid message",
      });
      return;
    }

    const message = {
      id: randomUUID(),
      room,
      nickname: socket.data.nickname,
      body: parsed.data.body,
      sentAt: Date.now(),
    };

    rooms.append(message);
    io.to(room).emit("message:new", message);
  });

  socket.on("disconnect", () => {
    const room = socket.data.room;
    if (!room) return;
    rooms.leave(room, socket.id);
    io.to(room).emit("room:members", rooms.members(room));
  });
});

httpServer.listen(PORT, () => {
  console.log(`[api] listening on :${PORT} (default room: ${DEFAULT_ROOM})`);
});

/**
 * Docker sends SIGTERM on `docker compose down` / rolling restart. Without
 * this, the process is SIGKILLed after a 10s grace period and every open
 * socket dies mid-flight.
 */
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`[api] ${signal} received, closing`);
    io.close(() => httpServer.close(() => process.exit(0)));
  });
}
