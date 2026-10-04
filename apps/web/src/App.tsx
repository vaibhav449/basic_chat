import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_ROOM,
  MAX_MESSAGE_LENGTH,
  MAX_NICKNAME_LENGTH,
} from "@chat/shared";
import { useChat } from "./useChat";

function formatTime(epochMillis: number): string {
  return new Date(epochMillis).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function App() {
  const { status, error, room, messages, members, join, send } = useChat();
  const [nickname, setNickname] = useState("");
  const [roomInput, setRoomInput] = useState(DEFAULT_ROOM);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  if (status !== "joined") {
    return (
      <main className="shell shell--center">
        <form
          className="card"
          onSubmit={(event) => {
            event.preventDefault();
            join(nickname, roomInput);
          }}
        >
          <h1>basic-chat</h1>
          <p className="muted">A monorepo deployed with Docker.</p>
          <label>
            Nickname
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              maxLength={MAX_NICKNAME_LENGTH}
              placeholder="vaibhav"
              required
              autoFocus
            />
          </label>
          <label>
            Room
            <input
              value={roomInput}
              onChange={(event) => setRoomInput(event.target.value)}
              placeholder={DEFAULT_ROOM}
              required
            />
          </label>
          <button type="submit" disabled={status === "connecting"}>
            {status === "connecting" ? "Connecting…" : "Join"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="bar">
        <strong>#{room}</strong>
        <span className="muted">
          {members.length} online · {members.join(", ")}
        </span>
      </header>

      <div className="log" ref={scrollRef}>
        {messages.length === 0 && (
          <p className="muted empty">No messages yet. Say something.</p>
        )}
        {messages.map((message) => (
          <article key={message.id} className="msg">
            <span className="msg__meta">
              <b>{message.nickname}</b>
              <time>{formatTime(message.sentAt)}</time>
            </span>
            <p>{message.body}</p>
          </article>
        ))}
      </div>

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          const body = draft.trim();
          if (!body) return;
          send(body);
          setDraft("");
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder={`Message #${room}`}
          autoFocus
        />
        <button type="submit">Send</button>
      </form>

      {error && <p className="error">{error}</p>}
    </main>
  );
}
