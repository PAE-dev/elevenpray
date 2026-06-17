"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const COUNTRY_CODES = [
  { code: "PE", dial: "+51", label: "Perú" },
  { code: "MX", dial: "+52", label: "México" },
  { code: "CO", dial: "+57", label: "Colombia" },
  { code: "AR", dial: "+54", label: "Argentina" },
  { code: "CL", dial: "+56", label: "Chile" },
  { code: "EC", dial: "+593", label: "Ecuador" },
  { code: "BO", dial: "+591", label: "Bolivia" },
  { code: "US", dial: "+1", label: "Estados Unidos" },
] as const;

const INPUT_CLASS =
  "h-11 min-w-0 flex-1 rounded-[var(--radius-md)] border-[0.5px] border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-50";

type PhoneInputWithCountryProps = {
  countryCode: string;
  onCountryCodeChange: (code: string) => void;
  phoneDigits: string;
  onPhoneDigitsChange: (digits: string) => void;
  disabled?: boolean;
  error?: string;
};

export function PhoneInputWithCountry({
  countryCode,
  onCountryCodeChange,
  phoneDigits,
  onPhoneDigitsChange,
  disabled,
  error,
}: PhoneInputWithCountryProps) {
  const t = useTranslations("studentWhatsApp");
  const errorId = useId();
  const selected = COUNTRY_CODES.find((c) => c.code === countryCode) ?? COUNTRY_CODES[0];

  function handlePhoneChange(value: string) {
    onPhoneDigitsChange(value.replace(/\D/g, ""));
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor="whatsapp-phone" className="text-sm font-medium text-[var(--text-primary)]">
        {t("phoneLabel")}
      </label>
      <div className="flex gap-2">
        <Select
          value={countryCode}
          onValueChange={onCountryCodeChange}
          disabled={disabled}
        >
          <SelectTrigger
            className="h-11 w-[7.5rem] shrink-0"
            aria-label={t("countryLabel")}
          >
            <SelectValue>{selected.dial}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {COUNTRY_CODES.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                {country.dial} {country.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          id="whatsapp-phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={t("phonePlaceholder")}
          value={phoneDigits}
          onChange={(e) => handlePhoneChange(e.target.value)}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(INPUT_CLASS, error && "border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]/20")}
        />
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-[var(--error)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function buildE164Phone(countryCode: string, phoneDigits: string): string {
  const country = COUNTRY_CODES.find((c) => c.code === countryCode) ?? COUNTRY_CODES[0];
  return `${country.dial}${phoneDigits}`;
}

export function validatePhoneDigits(
  phoneDigits: string,
  t: (key: "validationMinDigits" | "validationDigitsOnly") => string,
): string | null {
  if (!/^\d+$/.test(phoneDigits) && phoneDigits.length > 0) {
    return t("validationDigitsOnly");
  }
  if (phoneDigits.length > 0 && phoneDigits.length < 9) {
    return t("validationMinDigits");
  }
  if (phoneDigits.length === 0) {
    return t("validationMinDigits");
  }
  return null;
}
