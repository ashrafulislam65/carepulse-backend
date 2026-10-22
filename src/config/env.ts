import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
  JWT_EXPIRES_IN: z.string().default("1d"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),

  QR_TOKEN_EXPIRES_IN: z.string().default("365d"),
  UNLOCK_TOKEN_EXPIRES_IN: z.string().default("15m"),

  TZ_OFFSET_MINUTES: z.coerce.number().default(360),
  SLOT_START_HOUR: z.coerce.number().default(9),
  SLOT_END_HOUR: z.coerce.number().default(17),
  SLOT_MINUTES: z.coerce.number().default(15),
  PAYMENT_CURRENCY: z.string().default("usd"),

  AWS_REGION: z.string().default("ap-southeast-1"),
  AWS_ACCESS_KEY_ID: z.string().default(""),
  AWS_SECRET_ACCESS_KEY: z.string().default(""),
  S3_BUCKET: z.string().default(""),

  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
});

export const env = schema.parse(process.env);