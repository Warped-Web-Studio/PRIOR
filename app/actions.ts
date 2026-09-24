"use server";

import { readInquiry, validateInquiry, type InquiryErrors } from "@/lib/validation";

export type InquiryResult = {
  status: "idle" | "ok" | "invalid";
  errors: InquiryErrors;
  name?: string;
};

/**
 * Concept piece: validates exactly as the client does and acknowledges.
 * Nothing is stored or sent anywhere.
 */
export async function requestAllocation(_prev: InquiryResult, data: FormData): Promise<InquiryResult> {
  const values = readInquiry(data);
  const errors = validateInquiry(values);
  if (Object.keys(errors).length > 0) return { status: "invalid", errors };
  // A considered pause — the register is not instant.
  await new Promise((r) => setTimeout(r, 700));
  return { status: "ok", errors: {}, name: values.name.split(/\s+/)[0] };
}
