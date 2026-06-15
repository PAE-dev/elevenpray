"use client";

import { useEffect, useMemo } from "react";
import { DayTimeline } from "./DayTimeline";
import { LisyyDailyAction } from "./LisyyDailyAction";
import { TodayCheckInSummary } from "./TodayCheckInSummary";
import { WellbeingActionsGrid } from "./WellbeingActionsGrid";
import { useWellbeingDayContext } from "./WellbeingDayProvider";

export function DayDiaryView() {
  const { entries, reload } = useWellbeingDayContext();

  useEffect(() => {
    void reload();
  }, [reload]);

  const timelineEntries = useMemo(
    () => entries.filter((entry) => entry.entryType !== "checkin"),
    [entries],
  );

  return (
    <div className="flex flex-col gap-4">
      <TodayCheckInSummary index={0} />
      <LisyyDailyAction index={1} />
      <DayTimeline entries={timelineEntries} />
      <WellbeingActionsGrid index={2} />
    </div>
  );
}
