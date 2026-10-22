import { Request, Response, Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/errors";
import { triageLimiter } from "../../middlewares/rateLimit";
import { assess } from "./triage.service";

const schema = z.object({
  symptoms: z.string().min(3).max(1000),
  age: z.number().int().min(0).max(120).optional(),
});

const router = Router();

router.post(
  "/check",
  triageLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { symptoms, age } = schema.parse(req.body);
    res.json({ success: true, data: assess(symptoms, age) });
  })
);

export default router;