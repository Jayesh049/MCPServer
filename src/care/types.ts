import { z } from "zod";

export const ExerciseSchema = z.object({
  name: z.string(),
  description: z.string(),
  frequency: z.string(),
  intensity: z.enum(["low", "moderate", "high"]),
  cautions: z.array(z.string()).default([])
});
export type Exercise = z.infer<typeof ExerciseSchema>;

export const MedicationSchema = z.object({
  name: z.string(),
  dose: z.string(),
  schedule: z.string(),
  rationale: z.string(),
  cautions: z.array(z.string()).default([])
});
export type Medication = z.infer<typeof MedicationSchema>;

export const HospitalSchema = z.object({
  name: z.string(),
  city: z.string(),
  country: z.string()
});
export type Hospital = z.infer<typeof HospitalSchema>;

export const DoctorSchema = z.object({
  name: z.string(),
  specialty: z.string(),
  yearsOfExperience: z.number().int().nonnegative(),
  hospital: HospitalSchema,
  bio: z.string(),
  medications: z.array(MedicationSchema).length(10)
});
export type Doctor = z.infer<typeof DoctorSchema>;

export const AffirmationSchema = z.object({
  theme: z.string(),
  statement: z.string()
});
export type Affirmation = z.infer<typeof AffirmationSchema>;

export const CarePlanSchema = z.object({
  diseaseSlug: z.string(),
  diseaseName: z.string(),
  synthetic: z.literal(true),
  generatedAt: z.string(),
  exercises: z.array(ExerciseSchema),
  topDoctors: z.array(DoctorSchema).length(5),
  affirmations: z.array(AffirmationSchema),
  disclaimers: z.array(z.string())
});
export type CarePlan = z.infer<typeof CarePlanSchema>;
