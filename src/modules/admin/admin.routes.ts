import { Router } from "express";
import { asyncHandler } from "../../utils/errors";
import { authenticate, authorize } from "../../middlewares/auth";
import { createStaffUser } from "./admin.controller";

const router = Router();

router.post("/users", authenticate, authorize("ADMIN"), asyncHandler(createStaffUser));

export default router;