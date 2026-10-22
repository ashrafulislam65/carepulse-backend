import { Router } from "express";
import { asyncHandler } from "../../utils/errors";
import { authenticate, authorize } from "../../middlewares/auth";
import { createHospital, listHospitals } from "./hospitals.controller";

const router = Router();

router.get("/", authenticate, asyncHandler(listHospitals));
router.post("/", authenticate, authorize("ADMIN"), asyncHandler(createHospital));

export default router;