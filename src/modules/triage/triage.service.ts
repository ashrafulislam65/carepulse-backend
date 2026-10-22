// Rule-based engine. Pore eta LLM/ML model diye replace kora jabe, shudhu assess() function-ta change hobe.
const EMERGENCY = [
  "chest pain", "difficulty breathing", "shortness of breath", "unconscious", "seizure",
  "severe bleeding", "stroke", "slurred speech", "face drooping", "throat swelling",
  "choking", "heart attack", "suicidal",
];
const URGENT = [
  "high fever", "fever", "vomiting", "abdominal pain", "fracture", "deep cut",
  "dehydration", "severe headache", "burn", "diarrhea",
];
const MILD = ["cold", "cough", "sore throat", "runny nose", "mild headache", "rash", "fatigue", "body ache"];

const RECOMMENDATIONS = {
  EMERGENCY: "Go to the nearest emergency room or call emergency services immediately.",
  URGENT: "See a doctor today. Consider an urgent-care visit or a tele-consultation.",
  NON_URGENT: "Home care and rest are likely enough. Book a regular appointment if symptoms last more than a few days.",
} as const;

export const assess = (text: string, age?: number) => {
  const t = text.toLowerCase();
  const hit = (list: string[]) => list.filter((k) => t.includes(k));
  const em = hit(EMERGENCY);
  const ur = hit(URGENT);
  const mi = hit(MILD);

  let score = em.length * 10 + ur.length * 4 + mi.length;
  if (age !== undefined && (age < 2 || age > 65)) score += 2;

  const urgency = em.length ? "EMERGENCY" : score >= 4 ? "URGENT" : "NON_URGENT";

  return {
    urgency,
    urgencyScore: Number(Math.min(1, score / 10).toFixed(2)),
    matchedSymptoms: [...em, ...ur, ...mi],
    recommendation: RECOMMENDATIONS[urgency],
    disclaimer: "This is an automated screening aid, not a medical diagnosis. If in doubt, seek care.",
  };
};