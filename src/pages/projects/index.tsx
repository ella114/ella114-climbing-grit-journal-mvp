import { ProjectLogsContent } from "@/features/logs/project-content";
import { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { consumeNextLogsOpenBetaPrefill } from "@/utils/logs-navigation";
import type { OpenBetaLogPrefill } from "@/utils/logs-navigation";

export default function ProjectsPage() {
  const [openBetaPrefill, setOpenBetaPrefill] = useState<OpenBetaLogPrefill | undefined>();

  useDidShow(() => {
    const nextOpenBetaPrefill = consumeNextLogsOpenBetaPrefill();

    if (nextOpenBetaPrefill?.target === "project") {
      setOpenBetaPrefill(nextOpenBetaPrefill);
    }
  });

  return <ProjectLogsContent openBetaPrefill={openBetaPrefill} />;
}
