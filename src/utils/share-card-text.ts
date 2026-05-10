import { MetricResult, ShareCard } from "@/types/domain";

function renderMetric(metric: MetricResult) {
  return `${metric.title}: ${metric.value}｜${metric.detail}`;
}

export function buildShareCardText(card: ShareCard) {
  switch (card.type) {
    case "session_recap": {
      const data = card.data as {
        locationName?: string;
        discipline?: string;
        climbCount?: number;
        sessionCount?: number;
        highestGrade?: string;
        totalAttempts?: number;
        sentCount?: number;
        workingCount?: number;
        summary?: string;
      };

      return [
        card.title,
        card.subtitle ?? "",
        `地点：${data.locationName ?? "未填写"}`,
        `类型：${data.discipline ?? "未填写"}`,
        data.sessionCount !== undefined ? `Session 数：${data.sessionCount}` : undefined,
        `Climb 数：${data.climbCount ?? 0}`,
        `最高难度：${data.highestGrade ?? "待积累"}`,
        `总尝试：${data.totalAttempts ?? 0}`,
        data.sentCount !== undefined ? `完成：${data.sentCount}` : undefined,
        data.workingCount !== undefined ? `继续攻克：${data.workingCount}` : undefined,
        `一句复盘：${data.summary ?? ""}`
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "project_send": {
      const data = card.data as {
        gradeLabel?: string;
        totalAttempts?: number;
        totalSessions?: number;
        sentDate?: string;
        fearDelta?: string;
      };

      return [
        card.title,
        card.subtitle ?? "",
        `难度：${data.gradeLabel ?? "未填写"}`,
        `累计尝试：${data.totalAttempts ?? 0}`,
        `累计 Session：${data.totalSessions ?? 0}`,
        `完攀日期：${data.sentDate ?? "未记录"}`,
        `恐惧变化：${data.fearDelta ?? "数据不足"}`
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "weekly_growth": {
      const data = card.data as {
        weeklySessionCount?: number;
        weeklyClimbCount?: number;
        activeProjectCount?: number;
        summary?: string;
        metrics?: MetricResult[];
      };

      return [
        card.title,
        card.subtitle ?? "",
        `本周 Session：${data.weeklySessionCount ?? 0}`,
        `本周新增 Climb：${data.weeklyClimbCount ?? 0}`,
        `Active Project：${data.activeProjectCount ?? 0}`,
        `总结：${data.summary ?? ""}`,
        ...(data.metrics ?? []).map(renderMetric)
      ]
        .filter(Boolean)
        .join("\n");
    }
  }
}
