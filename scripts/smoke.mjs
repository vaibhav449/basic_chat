/**
 * End-to-end smoke test: connects two real socket clients to a running stack
 * and asserts that one sees the other's message.
 *
 * Used in three places - locally, in CI against docker compose, and against
 * the Azure VM right after a deploy. A deploy that cannot pass this is a
 * failed deploy, which is the whole point of having it.
 *
 *   node scripts/smoke.mjs http://localhost:8080
 */
import { io } from "socket.io-client";

const BASE = (process.argv[2] ?? "http://localhost:8080").replace(/\/$/, "");
const ROOM = `smoke-${Date.now().toString(36)}`;
const TIMEOUT_MS = 15_000;

function connect(nickname) {
  const socket = io(BASE, { path: "/socket.io", transports: ["websocket"] });
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
    socket.on("server:error", ({ message }) =>
      reject(new Error(`server rejected ${nickname}: ${message}`)),
    );
  });
}

function joined(socket, nickname) {
  return new Promise((resolve) => {
    socket.once("room:snapshot", resolve);
    socket.emit("room:join", { room: ROOM, nickname });
  });
}

async function main() {
  const health = await fetch(`${BASE}/api/health`);
  if (!health.ok) throw new Error(`health check returned ${health.status}`);
  const body = await health.json();
  if (body.ok !== true) throw new Error(`unexpected health body: ${JSON.stringify(body)}`);
  console.log(`  ok  GET /api/health -> ${JSON.stringify(body)}`);

  const [alice, bob] = await Promise.all([connect("alice"), connect("bob")]);
  await joined(alice, "alice");
  const bobSnapshot = await joined(bob, "bob");
  console.log(`  ok  two clients joined #${ROOM} (members: ${bobSnapshot.members.join(", ")})`);

  const expected = `hello from alice ${Date.now()}`;
  const delivered = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("bob never received alice's message")),
      TIMEOUT_MS,
    );
    bob.on("message:new", (message) => {
      if (message.body !== expected) return;
      clearTimeout(timer);
      resolve(message);
    });
  });

  alice.emit("message:send", { body: expected });
  const message = await delivered;
  if (message.nickname !== "alice") {
    throw new Error(`wrong author: ${message.nickname}`);
  }
  console.log(`  ok  broadcast delivered to second client`);

  alice.close();
  bob.close();
  console.log(`\nsmoke passed against ${BASE}`);
}

const bail = setTimeout(() => {
  console.error(`smoke timed out after ${TIMEOUT_MS}ms`);
  process.exit(1);
}, TIMEOUT_MS * 2);

main()
  .then(() => {
    clearTimeout(bail);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\nsmoke FAILED against ${BASE}\n${error.message}`);
    process.exit(1);
  });
