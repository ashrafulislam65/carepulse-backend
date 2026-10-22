import rateLimit from "express-rate-limit";

const make = (windowMs: number, limit: number) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests, please try again later" },
  });

export const authLimiter = make(15 * 60 * 1000, 20);
export const pinLimiter = make(15 * 60 * 1000, 5);
export const triageLimiter = make(60 * 1000, 20);