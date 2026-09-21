"use client";
import { useTranslation } from "@/components/settings/LocalizedText";

import { publicTranslator } from "@/lib/public-i18n/translate";
import { useState } from "react";
import { Bug, Mail } from "lucide-react";
import { trackEvent } from "@/lib/tracking";
import { usePublicText } from "@/components/landing/PublicLanguageProvider";
import { emptySupportDraft, usePublicSupportDraft } from "@/components/landing/PublicDraftProvider";

type BugReportFormProps = {
  supportEmail: string;
};

export function BugReportForm({ supportEmail }: BugReportFormProps) {
  const appText = useTranslation();
  const publicText = usePublicText();
  const t = (source: string, values?: Record<string, string | number>) => publicText.isPublic ? publicText.t(source, values) : appText.owned(source, values);
  const draftText = publicText.isPublic ? publicText.t : publicTranslator();
  const shared = usePublicSupportDraft();
  const [localDraft, setLocalDraft] = useState(emptySupportDraft);
  const { summary, details, contact } = publicText.isPublic && shared ? shared.draft : localDraft;
  const setDraft = publicText.isPublic && shared ? shared.setDraft : setLocalDraft;
  const update = (field: "summary" | "details" | "contact", value: string) => setDraft(current => ({ ...current, [field]: value }));
  const validation = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, message: string) => {
    if (publicText.isPublic) event.currentTarget.setCustomValidity(message);
  };

  const submitReport = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    trackEvent("bug_report_mailto_started", {
      has_contact: Boolean(contact.trim()),
      has_details: Boolean(details.trim()),
    });

    const body = [
      draftText("Summary: {summary}", { summary: summary.trim() || draftText("Bug report") }),
      "",
      draftText("Details:"),
      details.trim() || draftText("Please describe what happened, what you expected, and any steps to reproduce."),
      "",
      draftText("Contact: {contact}", { contact: contact.trim() || draftText("Not provided") }),
      draftText("Page: {page}", { page: publicText.isPublic ? window.location.origin + window.location.pathname : window.location.href }),
      draftText("Browser: {browser}", { browser: navigator.userAgent }),
      draftText("Timestamp: {timestamp}", { timestamp: new Date().toISOString() }),
    ].join("\n");

    const subject = `[Lab Lords bug] ${summary.trim() || draftText("Bug report")}`;
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
          <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">{t("Report a bug")}</h2>
          <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{t("The form opens a pre-filled email with page, browser, and timestamp details.")}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-medium text-[color:var(--text-secondary)]">
          {t("Summary")}<input
            required
            maxLength={160}
            pattern={".*\\S.*"}
            value={summary}
            onChange={event => update("summary", event.target.value)}
            onInvalid={event => validation(event, t("Enter a short summary."))}
            onInput={event => event.currentTarget.setCustomValidity("")}
            className="h-11 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-input-border)] bg-[color:var(--ui-form-input-bg)] px-3 text-sm text-[color:var(--ui-form-input-text)] outline-none focus:border-[color:var(--ui-form-accent)]"
            placeholder={t("Short description")}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-[color:var(--text-secondary)]">
          {t("Details")}<textarea
            required
            minLength={10}
            maxLength={4000}
            value={details}
            onChange={event => update("details", event.target.value)}
            onInvalid={event => validation(event, t("Enter at least 10 characters describing the issue."))}
            onInput={event => event.currentTarget.setCustomValidity("")}
            className="min-h-32 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-input-border)] bg-[color:var(--ui-form-input-bg)] px-3 py-3 text-sm text-[color:var(--ui-form-input-text)] outline-none focus:border-[color:var(--ui-form-accent)]"
            placeholder={t("What happened? What did you expect? What steps reproduce it?")}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-[color:var(--text-secondary)]">
          {t("Contact email")}<input
            type="email"
            maxLength={254}
            value={contact}
            onChange={event => update("contact", event.target.value)}
            onInvalid={event => validation(event, t("Enter a valid email address."))}
            onInput={event => event.currentTarget.setCustomValidity("")}
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
        {t("Open email")}</button>
    </form>
  );
}
