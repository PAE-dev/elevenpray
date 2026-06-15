"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { StudentPageShell } from "../../components/StudentPageShell";
import { WellbeingCheckInBlock } from "./WellbeingCheckInBlock";
import { WellbeingCheckInProvider } from "./WellbeingCheckInContext";
import { useWellbeingCheckInContext } from "./WellbeingCheckInContext";
import { WellbeingDayProvider } from "./WellbeingDayProvider";
import { useWellbeingDayContext } from "./WellbeingDayProvider";
import { DayDiaryView } from "./DayDiaryView";
import { WellbeingDataSidebar } from "./WellbeingDataSidebar";

type WellbeingPageContentProps = {
  bare?: boolean;
  showDisclaimer?: boolean;
};

function CheckInDaySync() {
  const { savedFlash } = useWellbeingCheckInContext();
  const { reload } = useWellbeingDayContext();

  useEffect(() => {
    if (savedFlash) void reload();
  }, [savedFlash, reload]);

  return null;
}

function WellbeingStateSwitcher() {
  const { hydrated, hasCheckedInToday, isEditing } = useWellbeingCheckInContext();
  const showDiary = hydrated && hasCheckedInToday && !isEditing;

  return (
    <AnimatePresence mode="wait">
      {showDiary ? (
        <motion.div
          key="state-b"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <DayDiaryView />
        </motion.div>
      ) : (
        <motion.div
          key="state-a"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <WellbeingCheckInBlock index={0} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function WellbeingPageLayout({ showDisclaimer }: { showDisclaimer: boolean }) {
  const t = useTranslations("studentWellbeing");

  return (
    <div className="wellbeing-calm-page pb-12">
      <CheckInDaySync />
      <div className="mx-auto flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-[65]">
          <WellbeingStateSwitcher />
        </div>
        <div className="min-w-0 flex-[35] shrink-0 lg:sticky lg:top-20">
          <WellbeingDataSidebar />
        </div>
      </div>

      {showDisclaimer ? (
        <p className="mx-auto mt-12 max-w-4xl text-center text-xs leading-relaxed text-[var(--app-fg-muted)]/70">
          {t("disclaimer")}
        </p>
      ) : null}
    </div>
  );
}

export function WellbeingPageContent({
  bare = false,
  showDisclaimer = true,
}: WellbeingPageContentProps) {
  const t = useTranslations("studentWellbeing");

  const body = (
    <WellbeingCheckInProvider>
      <WellbeingDayProvider>
        <WellbeingPageLayout showDisclaimer={showDisclaimer} />
      </WellbeingDayProvider>
    </WellbeingCheckInProvider>
  );

  if (bare) return body;

  return (
    <StudentPageShell title={t("title")} maxWidth="max-w-7xl">
      {body}
    </StudentPageShell>
  );
}
