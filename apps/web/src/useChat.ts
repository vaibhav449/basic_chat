import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage } from "@chat/shared";
import { createSocket, type ChatSocket } from "./socket";

type Status = "idle" | "connecting" | "joined" | "error";

export function useChat() {
  const socketRef = useRef<ChatSocket | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<string[]>([]);

  // One socket per mounted component, torn down on unmount so React 18's
  // double-invoked effects in dev do not leave a dangling connection.
  const socket = useMemo(() => {
    const created = createSocket();
    socketRef.current = created;
    return created;
  }, []);

  useEffect(() => {
    socket.on("room:snapshot", (snapshot) => {
      setRoom(snapshot.room);
      setMessages(snapshot.history);
      setMembers(snapshot.members);
      setStatus("joined");
      setError(null);
    });
    socket.on("room:members", setMembers);
    socket.on("message:new", (message) => {
      setMessages((prev) => [...prev, message]);
    });
    socket.on("server:error", ({ message }) => {
      setError(message);
      setStatus("error");
    });
    socket.on("disconnect", () => {
      setStatus("connecting");
    });
    socket.on("connect_error", (err) => {
      setError(err.message);
      setStatus("error");
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [socket]);

  const join = useCallback(
    (nickname: string, nextRoom: string) => {
      setStatus("connecting");
      setError(null);
      setMessages([]);
      if (!socket.connected) socket.connect();
      socket.emit("room:join", { nickname, room: nextRoom });
    },
    [socket],
  );

  const send = useCallback(
    (body: string) => {
      socket.emit("message:send", { body });
    },
    [socket],
  );

  return { status, error, room, messages, members, join, send };
}
