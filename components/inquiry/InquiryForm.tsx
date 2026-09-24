"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { requestAllocation, type InquiryResult } from "@/app/actions";
import { inquiry } from "@/lib/brand";
import { LIMITS, readInquiry, validateInquiry, type InquiryErrors, type InquiryValues } from "@/lib/validation";

const initial: InquiryResult = { status: "idle", errors: {} };
const ORDER: (keyof InquiryValues)[] = ["name", "email", "organization", "reason"];

export function InquiryForm() {
  const [result, formAction, pending] = useActionState(requestAllocation, initial);
  const [clientErrors, setClientErrors] = useState<InquiryErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof InquiryValues, boolean>>>({});
  const successRef = useRef<HTMLDivElement>(null);

  const errors = result.status === "invalid" && Object.keys(clientErrors).length === 0 ? result.errors : clientErrors;

  useEffect(() => {
    if (result.status === "ok") successRef.current?.focus();
  }, [result.status]);

  const focusFirstInvalid = (form: HTMLFormElement, errs: InquiryErrors) => {
    const first = ORDER.find((k) => errs[k]);
    if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  };

  const revalidate = (field: keyof InquiryValues, form: HTMLFormElement | null) => {
    if (!form) return;
    const next = validateInquiry(readInquiry(new FormData(form)));
    setClientErrors((prev) => {
      const out = { ...prev };
      if (next[field]) out[field] = next[field];
      else delete out[field];
      return out;
    });
  };

  if (result.status === "ok") {
    return (
      <div className="form-success" ref={successRef} tabIndex={-1} role="status" data-inquiry-reveal>
        <p className="kicker mono">Entered · {new Date().getFullYear()} draw</p>
        <h2 className="form-success__title display">
          {result.name ? `${result.name}, you` : "You"} are in the register.
        </h2>
        <p className="body">{inquiry.successBody}</p>
      </div>
    );
  }

  const field = (
    name: keyof InquiryValues,
    label: string,
    input: (props: {
      id: string;
      name: string;
      "aria-invalid": boolean;
      "aria-describedby"?: string;
      onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    }) => React.ReactNode,
    optional = false,
  ) => {
    const id = `f-${name}`;
    const err = errors[name];
    return (
      <div className={`field ${err ? "field--error" : ""}`} data-inquiry-reveal>
        <label htmlFor={id} className="field__label mono">
          {label}
          {optional && <span className="field__optional"> — {inquiry.optional}</span>}
        </label>
        {input({
          id,
          name,
          "aria-invalid": Boolean(err),
          "aria-describedby": err ? `${id}-error` : undefined,
          onBlur: (e) => {
            setTouched((t) => ({ ...t, [name]: true }));
            revalidate(name, e.currentTarget.form);
          },
          onChange: (e) => {
            if (touched[name] || errors[name]) revalidate(name, e.currentTarget.form);
          },
        })}
        <p id={`${id}-error`} className="field__error" aria-live="polite">
          {err ?? ""}
        </p>
      </div>
    );
  };

  return (
    <form
      className="form"
      action={formAction}
      noValidate
      onSubmit={(e) => {
        const errs = validateInquiry(readInquiry(new FormData(e.currentTarget)));
        setClientErrors(errs);
        if (Object.keys(errs).length > 0) {
          e.preventDefault();
          focusFirstInvalid(e.currentTarget, errs);
        }
      }}
    >
      {field("name", inquiry.fields.name, (p) => (
        <input {...p} className="field__input" type="text" autoComplete="name" maxLength={LIMITS.name} required />
      ))}
      {field("email", inquiry.fields.email, (p) => (
        <input
          {...p}
          className="field__input"
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={LIMITS.email}
          required
        />
      ))}
      {field(
        "organization",
        inquiry.fields.organization,
        (p) => <input {...p} className="field__input" type="text" autoComplete="organization" maxLength={LIMITS.organization} />,
        true,
      )}
      {field("reason", inquiry.fields.reason, (p) => (
        <textarea {...p} className="field__input field__input--area" rows={3} maxLength={LIMITS.reason} required />
      ))}

      <div className="form__submit" data-inquiry-reveal>
        <button type="submit" className="submit" disabled={pending} aria-busy={pending}>
          <span className="submit__label display">{pending ? inquiry.pending : inquiry.submit}</span>
          <span className="submit__rule" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
