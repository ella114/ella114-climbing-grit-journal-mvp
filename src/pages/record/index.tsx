import { SessionLogsContent } from "@/features/logs/session-content";
import { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { consumeNextLogsOpenBetaPrefill } from "@/utils/logs-navigation";
import type { OpenBetaLogPrefill } from "@/utils/logs-navigation";

export default function RecordPage() {
  const [openBetaPrefill, setOpenBetaPrefill] = useState<OpenBetaLogPrefill | undefined>();

  useDidShow(() => {
    const nextOpenBetaPrefill = consumeNextLogsOpenBetaPrefill();

    if (nextOpenBetaPrefill?.target === "session") {
      setOpenBetaPrefill(nextOpenBetaPrefill);
    }
  });

  return <SessionLogsContent openBetaPrefill={openBetaPrefill} />;
}
