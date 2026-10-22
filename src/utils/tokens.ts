import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export const signToken = (payload: object, expiresIn: string) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: expiresIn as SignOptions["expiresIn"] });

export const verifyToken = <T>(token: string) => jwt.verify(token, env.JWT_SECRET) as unknown as T;