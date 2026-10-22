import { Router } from "express";
import { asyncHandler } from "../../utils/errors";
import { authenticate, authorize } from "../../middlewares/auth";
import { book, cancel, complete, getSlots, listDoctors, listMine, queueStatus } from "./appointments.controller";

const router = Router();

router.get("/doctors", asyncHandler(listDoctors));
router.get("/doctors/:doctorId/slots", asyncHandler(getSlots));

router.use(authenticate);

router.post("/", authorize("PATIENT"), asyncHandler(book));
router.get("/mine", authorize("PATIENT", "DOCTOR", "ADMIN"), asyncHandler(listMine));
router.get("/:id/queue", authorize("PATIENT", "DOCTOR", "ADMIN"), asyncHandler(queueStatus));
router.patch("/:id/cancel", authorize("PATIENT", "DOCTOR", "ADMIN"), asyncHandler(cancel));
router.patch("/:id/complete", authorize("DOCTOR"), asyncHandler(complete));

export default router;