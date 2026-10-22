import { Router } from "express";
import { asyncHandler } from "../../utils/errors";
import { authenticate } from "../../middlewares/auth";
import { login, me, register } from "./auth.controller";

const router = Router();

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.get("/me", authenticate, asyncHandler(me));

export default router;