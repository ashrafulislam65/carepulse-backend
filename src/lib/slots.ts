import { env } from "../config/env";

const MIN = 60_000;

// UTC date-ke clinic timezone-er "YYYY-MM-DD" e convert
export const localDateString = (d: Date) =>
  new Date(d.getTime() + env.TZ_OFFSET_MINUTES * MIN).toISOString().slice(0, 10);

export const dayStart = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - env.TZ_OFFSET_MINUTES * MIN);
};

export const dayWindow = (dateStr: string) => {
  const start = dayStart(dateStr);
  return { start, end: new Date(start.getTime() + 24 * 60 * MIN) };
};

export const generateSlots = (dateStr: string) => {
  const start = dayStart(dateStr).getTime();
  const slots: Date[] = [];
  for (let m = env.SLOT_START_HOUR * 60; m < env.SLOT_END_HOUR * 60; m += env.SLOT_MINUTES) {
    slots.push(new Date(start + m * MIN));
  }
  return slots;
};

export const isValidSlot = (d: Date) =>
  generateSlots(localDateString(d)).some((s) => s.getTime() === d.getTime());