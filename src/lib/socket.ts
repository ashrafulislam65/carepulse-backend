import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { Role } from "@prisma/client";
import { z } from "zod";
import { env } from "../config/env";
import { prisma } from "./prisma";
import { verifyToken } from "../utils/tokens";

type SocketUser = { id: string; role: Role };

let io: Server | null = null;
export const getIO = () => io;

const locationSchema = z.object({
  alertId: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const initSocket = (server: HttpServer) => {
  io = new Server(server, { cors: { origin: env.FRONTEND_URL, credentials: true } });

  // Client: io(API_URL, { auth: { token } })
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Authentication required"));
    try {
      const p = verifyToken<{ sub?: string; role?: Role }>(token);
      if (!p.sub || !p.role) throw new Error("bad token");
      socket.data.user = { id: p.sub, role: p.role } as SocketUser;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as SocketUser;
    socket.join(`user:${user.id}`);
    if (user.role === "RESPONDER" || user.role === "ADMIN") socket.join("responders");

    // alert room-e join (live location dekhar jonno)
    socket.on("alert:join", async (alertId: string, ack?: (r: { ok: boolean }) => void) => {
      let ok = false;
      if (typeof alertId === "string") {
        if (user.role === "RESPONDER" || user.role === "ADMIN") {
          ok = true;
        } else if (user.role === "PATIENT") {
          const a = await prisma.emergencyAlert.findFirst({
            where: { id: alertId, patient: { userId: user.id } },
          });
          ok = !!a;
        }
      }
      if (ok) await socket.join(`alert:${alertId}`);
      ack?.({ ok });
    });

    // patient ba assigned responder-er live GPS
    socket.on("location:update", async (raw: unknown) => {
      const parsed = locationSchema.safeParse(raw);
      if (!parsed.success) return;
      const { alertId, latitude, longitude } = parsed.data;

      const alert = await prisma.emergencyAlert.findUnique({
        where: { id: alertId },
        include: { patient: { select: { userId: true } } },
      });
      if (!alert || !["TRIGGERED", "DISPATCHED"].includes(alert.status)) return;

      const isPatient = user.role === "PATIENT" && alert.patient.userId === user.id;
      const isResponder = user.role === "RESPONDER" && alert.responderId === user.id;
      if (!isPatient && !isResponder) return;

      if (isPatient) {
        await prisma.emergencyAlert.update({ where: { id: alertId }, data: { latitude, longitude } });
      }
      socket.to(`alert:${alertId}`).emit("location:update", {
        alertId,
        from: user.role,
        latitude,
        longitude,
        at: new Date().toISOString(),
      });
    });
  });

  return io;
};