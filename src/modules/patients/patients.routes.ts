import { Router } from "express";
import { asyncHandler } from "../../utils/errors";
import { authenticate, authorize } from "../../middlewares/auth";
import {
  addContact,
  deleteContact,
  getMe,
  getQr,
  revokeQr,
  setPin,
  updateContact,
  updateMe,
} from "./patients.controller";

const router = Router();

router.use(authenticate, authorize("PATIENT"));

router.get("/me", asyncHandler(getMe));
router.patch("/me", asyncHandler(updateMe));
router.put("/me/pin", asyncHandler(setPin));

router.post("/me/contacts", asyncHandler(addContact));
router.patch("/me/contacts/:id", asyncHandler(updateContact));
router.delete("/me/contacts/:id", asyncHandler(deleteContact));

router.get("/me/qr", asyncHandler(getQr));
router.post("/me/qr/revoke", asyncHandler(revokeQr));

export default router;