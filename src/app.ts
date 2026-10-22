import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { asyncHandler } from "./utils/errors";
import { authLimiter } from "./middlewares/rateLimit";
import { errorHandler, notFound } from "./middlewares/error";
import { stripeWebhook } from "./modules/payments/payments.controller";
import authRoutes from "./modules/auth/auth.routes";
import patientRoutes from "./modules/patients/patients.routes";
import emergencyRoutes from "./modules/emergency/emergency.routes";
import recordRoutes from "./modules/records/records.routes";
import alertRoutes from "./modules/alerts/alerts.routes";
import triageRoutes from "./modules/triage/triage.routes";
import appointmentRoutes from "./modules/appointments/appointments.routes";
import paymentRoutes from "./modules/payments/payments.routes";
import hospitalRoutes from "./modules/hospitals/hospitals.routes";
import adminRoutes from "./modules/admin/admin.routes";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

// Stripe webhook-e raw body lage, tai express.json()-er AGE
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), asyncHandler(stripeWebhook));

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "CarePulse API is running" });
});

app.use(["/api/auth/login", "/api/auth/register"], authLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/emergency", emergencyRoutes);
app.use("/api/records", recordRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/triage", triageRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;