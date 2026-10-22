import { Router } from "express";
import { asyncHandler } from "../../utils/errors";
import { authenticate, authorize } from "../../middlewares/auth";
import { acceptAlert, cancelAlert, createAlert, getAlert, listActive, resolveAlert } from "./alerts.controller";

const router = Router();

router.use(authenticate);

router.post("/", authorize("PATIENT"), asyncHandler(createAlert));
router.get("/active", authorize("RESPONDER", "ADMIN"), asyncHandler(listActive));
router.get("/:id", authorize("PATIENT", "RESPONDER", "ADMIN"), asyncHandler(getAlert));
router.patch("/:id/accept", authorize("RESPONDER"), asyncHandler(acceptAlert));
router.patch("/:id/resolve", authorize("RESPONDER", "ADMIN"), asyncHandler(resolveAlert));
router.patch("/:id/cancel", authorize("PATIENT"), asyncHandler(cancelAlert));

export default router;