import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const port = Number.parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOSTNAME || "localhost";
const production = process.env.NODE_ENV === "production" || process.argv.includes("--production");
if (production) process.env.NODE_ENV = "production";
const dev = !production;
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const httpServer = createServer((request, response) => handle(request, response));
const socketOrigins = (process.env.SOCKET_IO_ORIGINS || "http://localhost:3000,http://localhost:3100")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const io = new Server(httpServer, {
  path: "/socket.io",
  serveClient: false,
  cors: {
    origin: socketOrigins,
    credentials: true,
  },
});

io.use(async (socket, nextSocket) => {
  const accessToken = socket.handshake.auth?.accessToken;
  if (!accessToken) {
    nextSocket();
    return;
  }

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!projectUrl || !publishableKey) {
    nextSocket();
    return;
  }

  try {
    const supabase = createSupabaseClient(projectUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: { user } } = await supabase.auth.getUser(accessToken);
    socket.data.userId = user?.id || null;
    if (user) {
      const { data: membership } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      socket.data.isAdmin = Boolean(membership);
    }
  } catch {
    socket.data.userId = null;
    socket.data.isAdmin = false;
  }

  nextSocket();
});

io.on("connection", (socket) => {
  socket.join("invitations");
  socket.join("live-tournament");
  if (socket.data.userId) socket.join(`user:${socket.data.userId}`);

  socket.on("live:publish", ({ event } = {}) => {
    if (!socket.data.isAdmin) return;
    io.to("live-tournament").emit("live:update", event || null);
  });
});

globalThis.__khilafatSocketIo = io;

httpServer.listen(port, hostname, () => {
  console.log(`> Khilafat Esports ready on http://${hostname}:${port}`);
});

