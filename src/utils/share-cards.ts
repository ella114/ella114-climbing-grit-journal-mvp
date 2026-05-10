import { createId, nowIso } from "@/services/repositories";
import { Climb, ClimbingSession, Project, ShareCard } from "@/types/domain";
import { MetricResult } from "@/types/domain";

export function buildSessionRecapCard(userId: string, session: ClimbingSession, climbs: Climb[]): ShareCard {
  const highest = climbs
    .filter((climb) => climb.normalizedGradeValue !== undefined)
    .sort((a, b) => (b.normalizedGradeValue ?? 0) - (a.normalizedGradeValue ?? 0))[0];
  const totalAttempts = climbs.reduce((sum, climb) => sum + (climb.attemptsCount ?? 0), 0);

  return {
    id: createId("share"),
    userId,
    type: "session_recap",
    title: `${session.date} 今日复盘卡`,
    subtitle: "Send 不是唯一证明。",
    data: {
      locationName: session.locationName,
      discipline: session.discipline,
      climbCount: climbs.length,
      highestGrade: highest?.gradeLabel ?? "待积累",
      totalAttempts,
      summary: session.summary ?? "今天的进步，也许更像坚持。"
    },
    createdAt: nowIso()
  };
}

export function buildDailySessionRecapCard(userId: string, date: string, sessions: ClimbingSession[], climbs: Climb[]): ShareCard {
  const highest = climbs
    .filter((climb) => climb.normalizedGradeValue !== undefined)
    .sort((a, b) => (b.normalizedGradeValue ?? 0) - (a.normalizedGradeValue ?? 0))[0];
  const totalAttempts = climbs.reduce((sum, climb) => sum + (climb.attemptsCount ?? 0), 0);
  const sentCount = climbs.filter((climb) => climb.outcome === "sent").length;
  const workingCount = climbs.filter((climb) => climb.outcome === "in_progress").length;
  const locations = Array.from(new Set(sessions.map((session) => session.locationName).filter(Boolean)));
  const disciplines = Array.from(new Set(sessions.map((session) => session.discipline).filter(Boolean)));
  const writtenSummaries = sessions.map((session) => session.summary?.trim()).filter(Boolean);
  const summary =
    writtenSummaries.length > 0
      ? writtenSummaries.join(" / ")
      : `今天记录了 ${sessions.length} 段 Session、${climbs.length} 条 Climb，完成 ${sentCount} 条，继续攻克 ${workingCount} 条。`;

  return {
    id: createId("share"),
    userId,
    type: "session_recap",
    title: `${date} 今日攀岩复盘卡`,
    subtitle: "一天结束后，再看见自己的尝试。",
    data: {
      locationName: locations.length ? locations.join(" / ") : "未填写",
      discipline: disciplines.length ? disciplines.join(" / ") : "未填写",
      sessionCount: sessions.length,
      climbCount: climbs.length,
      highestGrade: highest?.gradeLabel ?? "待积累",
      totalAttempts,
      sentCount,
      workingCount,
      summary
    },
    createdAt: nowIso()
  };
}

export function buildProjectSendCard(userId: string, project: Project, totalAttempts: number, totalSessions: number, fearDelta?: string): ShareCard {
  const isSent = project.status === "sent";

  return {
    id: createId("share"),
    userId,
    type: "project_send",
    title: `${project.title} ${isSent ? "完攀卡" : "Project 卡"}`,
    subtitle: isSent ? "真正的进步，不只发生在最后一步。" : "正在推进的路线，也值得被认真记录。",
    data: {
      gradeLabel: project.gradeLabel,
      totalAttempts,
      totalSessions,
      sentDate: project.sentDate,
      fearDelta
    },
    createdAt: nowIso()
  };
}

export function buildWeeklyGrowthCard(
  userId: string,
  weeklySessionCount: number,
  weeklyClimbCount: number,
  activeProjectCount: number,
  metrics: MetricResult[],
  summary: string
): ShareCard {
  return {
    id: createId("share"),
    userId,
    type: "weekly_growth",
    title: "本周成长卡",
    subtitle: "You are getting braver, not just stronger.",
    data: {
      weeklySessionCount,
      weeklyClimbCount,
      activeProjectCount,
      metrics,
      summary
    },
    createdAt: nowIso()
  };
}
