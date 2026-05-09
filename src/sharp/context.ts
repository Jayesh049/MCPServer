import { z } from "zod";

export class SharpContextError extends Error {
  readonly httpStatus: number;

  constructor(message: string, httpStatus: number) {
    super(message);
    this.httpStatus = httpStatus;
  }
}

export type FhirContext = {
  fhirUrl: string;
  fhirToken?: string;
  patientId?: string;
};

const MetaSchema = z
  .object({
    fhirUrl: z.string().optional(),
    fhirToken: z.string().optional(),
    patientId: z.string().optional(),
    url: z.string().optional(),
    token: z.string().optional(),
    "X-FHIR-Server-URL": z.string().optional(),
    "X-FHIR-Access-Token": z.string().optional(),
    "X-Patient-ID": z.string().optional()
  })
  .passthrough();

export function extractFhirContextFromMeta(meta: unknown): FhirContext | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = MetaSchema.safeParse(meta);
  if (!m.success) return undefined;

  const fhirUrl = m.data.fhirUrl ?? m.data.url ?? m.data["X-FHIR-Server-URL"];
  const fhirToken = m.data.fhirToken ?? m.data.token ?? m.data["X-FHIR-Access-Token"];
  const patientId = m.data.patientId ?? m.data["X-Patient-ID"];

  if (!fhirUrl) return undefined;
  return { fhirUrl, fhirToken, patientId };
}

export function requireFhirContext(meta: unknown): FhirContext {
  const ctx = extractFhirContextFromMeta(meta);
  if (!ctx?.fhirUrl) {
    throw new SharpContextError(
      "Missing required FHIR context (fhirUrl / X-FHIR-Server-URL).",
      403
    );
  }
  return ctx;
}

