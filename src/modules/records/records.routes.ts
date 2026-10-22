import { Router } from "express";
import { asyncHandler } from "../../utils/errors";
import { authenticate, authorize } from "../../middlewares/auth";
import { createRecord, deleteRecord, getDownloadUrl, getUploadUrl, listRecords } from "./records.controller";

const router = Router();

router.use(authenticate);

router.post("/upload-url", authorize("PATIENT", "DOCTOR", "ADMIN"), asyncHandler(getUploadUrl));
router.post("/", authorize("PATIENT", "DOCTOR", "ADMIN"), asyncHandler(createRecord));
router.get("/", authorize("PATIENT", "DOCTOR", "ADMIN"), asyncHandler(listRecords));
router.get("/:id/download-url", authorize("PATIENT", "DOCTOR", "ADMIN"), asyncHandler(getDownloadUrl));
router.delete("/:id", authorize("PATIENT", "ADMIN"), asyncHandler(deleteRecord));

export default router;