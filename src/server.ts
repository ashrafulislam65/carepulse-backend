import http from "http";
import app from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { initSocket } from "./lib/socket";

process.on("unhandledRejection", (e) => console.error("unhandledRejection", e));
process.on("uncaughtException", (e) => console.error("uncaughtException", e));
const server = http.createServer(app);
initSocket(server);

server.listen(env.PORT, () => {
  console.log(`API + Socket.io running on http://localhost:${env.PORT}`);
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);