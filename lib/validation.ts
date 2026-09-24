/**
 * Shared by the client form and the server action so both reject the same
 * input with the same wording.
 */

export type InquiryValues = {
  name: string;
  email: string;
  organization: string;
  reason: string;
};

export type InquiryErrors = Partial<Record<keyof InquiryValues, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const LIMITS = { name: 120, email: 254, organization: 160, reason: 1200 } as const;

export function readInquiry(data: FormData): InquiryValues {
  const get = (k: string) => {
    const v = data.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  return {
    name: get("name"),
    email: get("email"),
    organization: get("organization"),
    reason: get("reason"),
  };
}

export function validateInquiry(v: InquiryValues): InquiryErrors {
  const errors: InquiryErrors = {};

  if (!v.name) errors.name = "Please tell us your name.";
  else if (v.name.length > LIMITS.name) errors.name = "That name is longer than we can record.";

  if (!v.email) errors.email = "An email address is needed so we can write to you.";
  else if (!EMAIL.test(v.email) || v.email.length > LIMITS.email)
    errors.email = "That email address doesn’t look complete.";

  if (v.organization.length > LIMITS.organization)
    errors.organization = "Please shorten this to 160 characters.";

  if (!v.reason) errors.reason = "A sentence is enough.";
  else if (v.reason.length < 8) errors.reason = "A little more, please — a sentence is enough.";
  else if (v.reason.length > LIMITS.reason) errors.reason = "Please keep this under 1,200 characters.";

  return errors;
}
