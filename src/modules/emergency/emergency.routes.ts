import { Router } from "express";
import { asyncHandler } from "../../utils/errors";
import { pinLimiter } from "../../middlewares/rateLimit";
import { getFullProfile, getPublicProfile, unlock } from "./emergency.controller";

const router = Router();

router.get("/:token", asyncHandler(getPublicProfile));
router.post("/:token/unlock", pinLimiter, asyncHandler(unlock));
router.get("/:token/full", asyncHandler(getFullProfile));

export default router;