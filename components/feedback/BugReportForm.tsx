"use client";

import { useState } from "react";
import { Bug, Mail } from "lucide-react";
import { trackEvent } from "@/lib/tracking";

type BugReportFormProps = {
  supportEmail: string;
};

export function BugReportForm({ supportEmail }: BugReportFormProps) {
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");

  const submitReport = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    trackEvent("bug_report_mailto_started", {
      has_contact: Boolean(contact.trim()),
      has_details: Boolean(details.trim()),
    });

    const body = [
      `Summary: ${summary.trim() || "Bug report"}`,
      "",
      "Details:",
      details.trim() || "Please describe what happened, what you expected, and any steps to reproduce.",
      "",
      `Contact: ${contact.trim() || "Not provided"}`,
      `Page: ${window.location.href}`,
      `Browser: ${navigator.userAgent}`,
      `Timestamp: ${new Date().toISOString()}`,
    ].join("\n");

    const subject = `[Lab Lords bug] ${summary.trim() || "Bug report"}`;
    window.location.href = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <form
      className="rounded-[var(--ui-radius-panel)] border border-[color:var(--ui-panel-border)] bg-[color:var(--ui-panel-bg)] p-5 shadow-[var(--ui-panel-shadow)]"
      onSubmit={submitReport}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-badge-warning-border)] bg-[color:var(--ui-badge-warning-bg)] text-[color:var(--ui-badge-warning-text)]">
          <Bug size={18} />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Report a bug</h2>
          <p className="mt-1 text-sm text-[color:var(--text-secondary)]">The form opens a pre-filled email with page, browser, and timestamp details.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-medium text-[color:var(--text-secondary)]">
          Summary
          <input
            value={summary}
            onChange={event => setSummary(event.target.value)}
            className="h-11 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-input-border)] bg-[color:var(--ui-form-input-bg)] px-3 text-sm text-[color:var(--ui-form-input-text)] outline-none focus:border-[color:var(--ui-form-accent)]"
            placeholder="Short description"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-[color:var(--text-secondary)]">
          Details
          <textarea
            value={details}
            onChange={event => setDetails(event.target.value)}
            className="min-h-32 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-input-border)] bg-[color:var(--ui-form-input-bg)] px-3 py-3 text-sm text-[color:var(--ui-form-input-text)] outline-none focus:border-[color:var(--ui-form-accent)]"
            placeholder="What happened? What did you expect? What steps reproduce it?"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-[color:var(--text-secondary)]">
          Contact email
          <input
            type="email"
            value={contact}
            onChange={event => setContact(event.target.value)}
            className="h-11 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-input-border)] bg-[color:var(--ui-form-input-bg)] px-3 text-sm text-[color:var(--ui-form-input-text)] outline-none focus:border-[color:var(--ui-form-accent)]"
            placeholder="you@example.com"
          />
        </label>
      </div>

      <button
        type="submit"
        className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-button-primary-border)] bg-[color:var(--ui-button-primary-bg)] px-5 text-sm font-semibold text-[color:var(--ui-button-primary-text)] shadow-[var(--ui-button-primary-shadow)] transition-colors hover:bg-[color:var(--ui-button-primary-hover-bg)]"
      >
        <Mail size={16} />
        Open email
      </button>
    </form>
  );
}
