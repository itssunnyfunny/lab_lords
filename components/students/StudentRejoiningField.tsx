"use client";

import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { FormField } from "@/components/ui/FormField";
import { formControlClass, formHelpTextClass } from "@/components/ui/formSurface";
import { financialCalendarDate } from "@/lib/feeReceiptDates";
import { cn } from "@/lib/utils";
import { firstStudentRejoiningDueDate, studentRejoiningToday } from "@/utils/studentRejoiningDate";

export function StudentRejoiningField({ value, onChange, disabled }: {
    value: string;
    onChange: (date: string) => void;
    disabled: boolean;
}) {
    const t = useTranslation();
    const { interfaceLanguage } = useUserPreferences();
    const today = studentRejoiningToday();
    const firstDue = value <= today ? firstStudentRejoiningDueDate(value) : null;

    return (
        <div className="space-y-2">
            <FormField label="Rejoining date" required>
                <input
                    type="date"
                    max={today}
                    value={value}
                    onChange={event => onChange(event.target.value)}
                    disabled={disabled}
                    className={cn(formControlClass, "min-h-11 px-3 text-base")}
                />
            </FormField>
            <p className={cn(formHelpTextClass, "text-sm")} aria-live="polite">
                {firstDue
                    ? t("First new monthly fee date is {date}.", { date: financialCalendarDate(firstDue, interfaceLanguage) })
                    : t("Enter the date the student returned to see their first new fee date.")}
            </p>
        </div>
    );
}
