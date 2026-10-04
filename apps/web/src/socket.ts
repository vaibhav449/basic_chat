import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@chat/shared";

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Note what is NOT here: a VITE_API_URL.
 *
 * Vite inlines `import.meta.env.VITE_*` at build time, so baking an API URL
 * into the bundle would mean rebuilding the image for every environment it
 * deploys to - the single most common Docker-plus-SPA mistake. Instead the
 * client always connects same-origin and the reverse proxy decides where
 * /socket.io actually goes. One image, any environment.
 */
export function createSocket(): ChatSocket {
  return io({
    path: "/socket.io",
    autoConnect: false,
    transports: ["websocket", "polling"],
  });
}
