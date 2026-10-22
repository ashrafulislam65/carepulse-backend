import { Router } from "express";
import { asyncHandler } from "../../utils/errors";
import { authenticate, authorize } from "../../middlewares/auth";
import { createCheckout, invoicePdf } from "./payments.controller";

const router = Router();

router.post("/checkout/:appointmentId", authenticate, authorize("PATIENT"), asyncHandler(createCheckout));
router.get(
  "/invoice/:appointmentId",
  authenticate,
  authorize("PATIENT", "DOCTOR", "ADMIN"),
  asyncHandler(invoicePdf)
);

export default router;