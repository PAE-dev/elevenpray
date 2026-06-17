"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/providers/auth-provider";
import {
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppStatus,
} from "@/app/lib/whatsapp/api";
import { StudentPageShell } from "../../components/StudentPageShell";
import {
  buildE164Phone,
  PhoneInputWithCountry,
  validatePhoneDigits,
} from "./PhoneInputWithCountry";

const EXAMPLE_KEYS = ["example1", "example2", "example3"] as const;

const stateTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: "easeOut" as const },
};

export function WhatsAppAssistantPageContent() {
  const t = useTranslations("studentWhatsApp");
  const tNav = useTranslations("studentNav");
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);

  const [countryCode, setCountryCode] = useState("PE");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [validationError, setValidationError] = useState("");
  const [apiError, setApiError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const status = await getWhatsAppStatus(token);
      setConnected(status.connected);
      setConnectedPhone(status.phone);
    } catch {
      setConnected(false);
      setConnectedPhone(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!token || submitting) return;

    const validation = validatePhoneDigits(phoneDigits, t);
    if (validation) {
      setValidationError(validation);
      setApiError("");
      return;
    }

    setValidationError("");
    setApiError("");
    setSubmitting(true);

    try {
      const phone = buildE164Phone(countryCode, phoneDigits);
      const result = await connectWhatsApp(token, phone);
      setConnected(true);
      setConnectedPhone(result.phone);
      setPhoneDigits("");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : t("connectError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisconnect() {
    if (!token || disconnecting) return;
    setDisconnecting(true);
    try {
      await disconnectWhatsApp(token);
      setConnected(false);
      setConnectedPhone(null);
      setApiError("");
      setValidationError("");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : t("disconnectError"));
    } finally {
      setDisconnecting(false);
    }
  }

  const displayError = validationError || apiError;

  return (
    <StudentPageShell title={tNav("whatsapp")} maxWidth="max-w-lg">
      <div className="mx-auto w-full max-w-md">
        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" aria-hidden />
            <span className="sr-only">{t("loading")}</span>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {connected ? (
              <motion.div key="connected" {...stateTransition}>
                <ConnectedState
                  phone={connectedPhone}
                  onDisconnect={handleDisconnect}
                  disconnecting={disconnecting}
                  disconnectError={!validationError ? apiError : ""}
                />
              </motion.div>
            ) : (
              <motion.div key="disconnected" {...stateTransition}>
                <DisconnectedState
                  countryCode={countryCode}
                  onCountryCodeChange={setCountryCode}
                  phoneDigits={phoneDigits}
                  onPhoneDigitsChange={(digits) => {
                    setPhoneDigits(digits);
                    if (validationError) setValidationError("");
                    if (apiError) setApiError("");
                  }}
                  displayError={displayError}
                  submitting={submitting}
                  onSubmit={handleConnect}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </StudentPageShell>
  );
}

function DisconnectedState({
  countryCode,
  onCountryCodeChange,
  phoneDigits,
  onPhoneDigitsChange,
  displayError,
  submitting,
  onSubmit,
}: {
  countryCode: string;
  onCountryCodeChange: (code: string) => void;
  phoneDigits: string;
  onPhoneDigitsChange: (digits: string) => void;
  displayError: string;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const t = useTranslations("studentWhatsApp");

  return (
    <div className="student-card space-y-8 p-8 text-center">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] sm:text-2xl">
          {t("title")}
        </h1>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <FeatureItem emoji="📝" label={t("featureTasks")} />
        <FeatureItem emoji="🔔" label={t("featureReminders")} />
        <FeatureItem emoji="📚" label={t("featureSubjects")} />
      </div>

      <form onSubmit={onSubmit} className="space-y-4 text-left">
        <PhoneInputWithCountry
          countryCode={countryCode}
          onCountryCodeChange={onCountryCodeChange}
          phoneDigits={phoneDigits}
          onPhoneDigitsChange={onPhoneDigitsChange}
          disabled={submitting}
          error={displayError || undefined}
        />
        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              {t("activating")}
            </>
          ) : (
            t("activateButton")
          )}
        </Button>
      </form>
    </div>
  );
}

function FeatureItem({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xl" aria-hidden>
        {emoji}
      </span>
      <span className="text-xs leading-tight text-[var(--text-muted)]">{label}</span>
    </div>
  );
}

function ConnectedState({
  phone,
  onDisconnect,
  disconnecting,
  disconnectError,
}: {
  phone: string | null;
  onDisconnect: () => void;
  disconnecting: boolean;
  disconnectError: string;
}) {
  const t = useTranslations("studentWhatsApp");

  return (
    <div className="student-card space-y-8 p-8 text-center">
      <div className="space-y-3">
        <CheckCircle2
          className="mx-auto h-14 w-14 text-[var(--accent)]"
          strokeWidth={1.5}
          aria-hidden
        />
        <h1 className="text-xl font-semibold text-[var(--text-primary)] sm:text-2xl">
          {t("connectedTitle")}
        </h1>
        {phone ? (
          <p className="font-mono text-sm text-[var(--text-muted)]">{phone}</p>
        ) : null}
      </div>

      <div className="rounded-[var(--radius-lg)] bg-[var(--bg-elevated)] p-4 text-left">
        <p className="mb-3 text-xs font-medium text-[var(--text-muted)]">{t("examplesTitle")}</p>
        <div className="space-y-3">
          {EXAMPLE_KEYS.map((key) => (
            <div
              key={key}
              className="rounded-2xl rounded-bl-sm border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm text-[var(--text-primary)]"
            >
              {t(key)}
            </div>
          ))}
        </div>
      </div>

      {disconnectError ? (
        <p className="text-sm text-[var(--error)]" role="alert">
          {disconnectError}
        </p>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onDisconnect}
        disabled={disconnecting}
        className="text-[var(--text-muted)]"
      >
        {disconnecting ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            {t("disconnecting")}
          </>
        ) : (
          t("disconnectButton")
        )}
      </Button>
    </div>
  );
}
