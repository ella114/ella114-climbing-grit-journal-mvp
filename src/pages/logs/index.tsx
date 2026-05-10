import { View } from "@tarojs/components";
import Taro, { useDidShow, useTabItemTap } from "@tarojs/taro";
import { useState } from "react";
import { PageHeader } from "@/components/common";
import { ProjectLogsContent } from "@/features/logs/project-content";
import { SessionLogsContent } from "@/features/logs/session-content";
import { consumeNextLogsOpenBetaPrefill, consumeNextLogsSessionEdit, consumeNextLogsView } from "@/utils/logs-navigation";
import type { LogsView, OpenBetaLogPrefill } from "@/utils/logs-navigation";

const LOGS_VIEWS: Array<{ label: string; value: LogsView }> = [
  { label: "Session", value: "session" },
  { label: "Project", value: "project" }
];

export default function LogsPage() {
  const [activeView, setActiveView] = useState<LogsView>("session");
  const [focusedSessionId, setFocusedSessionId] = useState<string | undefined>();
  const [openBetaPrefill, setOpenBetaPrefill] = useState<OpenBetaLogPrefill | undefined>();
  const [returnUrl, setReturnUrl] = useState<string | undefined>();
  const [sessionContentKey, setSessionContentKey] = useState(0);
  const [projectContentKey, setProjectContentKey] = useState(0);

  function clearOpenBetaContext() {
    setOpenBetaPrefill(undefined);
    setReturnUrl(undefined);
    setSessionContentKey((value) => value + 1);
    setProjectContentKey((value) => value + 1);
  }

  useDidShow(() => {
    const nextView = consumeNextLogsView();
    const nextSessionId = consumeNextLogsSessionEdit();
    const nextOpenBetaPrefill = consumeNextLogsOpenBetaPrefill();

    if (nextView) {
      setActiveView(nextView);
    }

    if (nextOpenBetaPrefill) {
      setActiveView(nextOpenBetaPrefill.target);
      setOpenBetaPrefill(nextOpenBetaPrefill);
      setReturnUrl(nextOpenBetaPrefill.returnUrl);
    }

    if (nextSessionId) {
      setActiveView("session");
      setFocusedSessionId(nextSessionId);
    }
  });

  useTabItemTap(() => {
    clearOpenBetaContext();
  });

  function handleBack() {
    if (returnUrl) {
      const separator = returnUrl.includes("?") ? "&" : "?";
      const targetUrl = `${returnUrl}${separator}fromLogsReturn=1`;
      clearOpenBetaContext();
      Taro.navigateTo({ url: targetUrl });
      return;
    }

    const pages = Taro.getCurrentPages();

    if (pages.length > 1) {
      Taro.navigateBack();
      return;
    }

    Taro.switchTab({ url: "/pages/home/index" });
  }

  return (
    <View className="page">
      <PageHeader title="Logs" subtitle="Session 和 Project 现在放到同一个入口。" showBack={Boolean(returnUrl)} onBack={handleBack} />
      <View className="choice-group" style={{ marginBottom: "16px" }}>
        {LOGS_VIEWS.map((view) => (
          <View key={view.value} className={`choice-chip ${activeView === view.value ? "active" : ""}`} onClick={() => setActiveView(view.value)}>
            {view.label}
          </View>
        ))}
      </View>

      {activeView === "session" ? (
        <SessionLogsContent
          key={sessionContentKey}
          showHeader={false}
          focusSessionId={focusedSessionId}
          openBetaPrefill={openBetaPrefill?.target === "session" ? openBetaPrefill : undefined}
          onFocusSessionHandled={() => setFocusedSessionId(undefined)}
        />
      ) : (
        <ProjectLogsContent
          key={projectContentKey}
          showHeader={false}
          openBetaPrefill={openBetaPrefill?.target === "project" ? openBetaPrefill : undefined}
          onRequestSessionView={() => setActiveView("session")}
          onRequestSessionEdit={(sessionId) => {
            setActiveView("session");
            setFocusedSessionId(sessionId);
          }}
        />
      )}
    </View>
  );
}
