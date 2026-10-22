import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { env } from "../config/env";
import { AppError } from "../utils/errors";

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "Authentication required"));
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as { sub?: string; role?: Role };
    // QR / unlock token-e sub ar role thake na, tai ei check dorkar
    if (!payload.sub || !payload.role) throw new Error("not an access token");
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new AppError(401, "Invalid or expired token"));
  }
};

export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, "You do not have permission"));
    }
    next();
  };