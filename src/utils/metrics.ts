import { Climb, ClimbingSession, MetricResult, Project } from "@/types/domain";

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function getAttemptEstimate(bucket: Climb["attemptsBucket"]) {
  switch (bucket) {
    case "1":
      return 1;
    case "2_3":
      return 2.5;
    case "4_6":
      return 5;
    case "7_10":
      return 8.5;
    case "10_plus":
      return 11;
  }
}

function percentage(value: number, total: number) {
  if (!total) {
    return "0%";
  }

  return `${Math.round((value / total) * 100)}%`;
}

function averageFear(climbs: Climb[]) {
  if (!climbs.length) {
    return undefined;
  }

  const total = climbs.reduce((sum, climb) => sum + climb.fearRating, 0);
  return Number((total / climbs.length).toFixed(1));
}

function filterClimbsByDays(climbs: Climb[], daysAgoStart: number, daysAgoEnd: number) {
  const today = startOfDay(new Date());
  const rangeStart = addDays(today, -(daysAgoStart - 1));
  const rangeEnd = addDays(today, 1 - daysAgoEnd);

  return climbs.filter((climb) => {
    const created = new Date(climb.createdAt);
    return created >= rangeStart && created < rangeEnd;
  });
}

export function calculateFearTrend(climbs: Climb[]): MetricResult {
  const recent = filterClimbsByDays(climbs, 30, 0);
  const previous = filterClimbsByDays(climbs, 60, 30);
  const recentAvg = averageFear(recent);
  const previousAvg = averageFear(previous);

  if (recentAvg === undefined || previousAvg === undefined) {
    return {
      title: "恐惧趋势",
      value: "数据不足",
      detail: "最近 60 天记录还不够，先多记几次真实尝试。",
      empty: true
    };
  }

  const delta = Number((recentAvg - previousAvg).toFixed(1));
  const label = delta <= 0 ? `下降 ${Math.abs(delta)}` : `上升 ${delta}`;

  return {
    title: "恐惧趋势",
    value: label,
    detail: delta <= 0 ? "你最近在类似尝试里更稳了。" : "最近的挑战更扎实，也更需要恢复。"
  };
}

export function calculatePushRate(climbs: Climb[]): MetricResult {
  const comparable = climbs.filter((climb) => climb.normalizedGradeValue !== undefined);

  if (!comparable.length) {
    return {
      title: "尝试强度",
      value: "数据不足",
      detail: "难度体系暂时无法比较，先保留原始 gradeLabel。",
      empty: true
    };
  }

  const maxGrade = Math.max(...comparable.map((climb) => climb.normalizedGradeValue ?? 0));
  const nearLimit = comparable.filter((climb) => (climb.normalizedGradeValue ?? 0) >= maxGrade - 1).length;

  return {
    title: "尝试强度",
    value: percentage(nearLimit, comparable.length),
    detail: "接近上限难度的投入越多，越能看见你没有只刷舒适区。"
  };
}

export function calculateComfortZoneRatio(climbs: Climb[]): MetricResult {
  const comparable = climbs.filter((climb) => climb.normalizedGradeValue !== undefined);

  if (!comparable.length) {
    return {
      title: "舒适区比例",
      value: "数据不足",
      detail: "可比较难度不足，暂不强行给结论。",
      empty: true
    };
  }

  const maxGrade = Math.max(...comparable.map((climb) => climb.normalizedGradeValue ?? 0));
  const comfort = comparable.filter((climb) => (climb.normalizedGradeValue ?? 0) <= maxGrade - 2).length;

  return {
    title: "舒适区比例",
    value: percentage(comfort, comparable.length),
    detail: comfort / comparable.length > 0.55 ? "这段时间偏恢复或偏保守，也许下一次可以再往上摸一点。" : "你没有一直停在熟悉范围里。"
  };
}

export function calculateProjectPersistence(projects: Project[], climbs: Climb[], _sessions: ClimbingSession[]): MetricResult {
  const activeProjects = projects.filter((project) => project.status === "active");

  if (!activeProjects.length) {
    return {
      title: "Project 韧性",
      value: "暂无",
      detail: "先把一条值得反复回来的线加进 Project。",
      empty: true
    };
  }

  const ranked = activeProjects
    .map((project) => {
      const relatedClimbs = climbs.filter((climb) => climb.projectId === project.id);
      const sessionIds = new Set(relatedClimbs.map((climb) => climb.sessionId));
      const totalAttempts = relatedClimbs.reduce((sum, climb) => sum + (climb.attemptsCount ?? getAttemptEstimate(climb.attemptsBucket)), 0);
      return {
        project,
        sessionCount: sessionIds.size,
        totalAttempts
      };
    })
    .sort((a, b) => b.sessionCount - a.sessionCount || b.totalAttempts - a.totalAttempts);

  const lead = ranked[0];

  return {
    title: "Project 韧性",
    value: `${lead.sessionCount} 次 Session`,
    detail: `${lead.project.title} 已累计约 ${Math.round(lead.totalAttempts)} 次尝试。Send 不是唯一证明，坚持本身也是。`
  };
}

export function calculateSessionConsistency(sessions: ClimbingSession[]): MetricResult {
  if (!sessions.length) {
    return {
      title: "训练稳定性",
      value: "暂无",
      detail: "从第一条 Session 开始，稳定性才会长出来。",
      empty: true
    };
  }

  const today = startOfDay(new Date());
  const weeklyCounts: number[] = [];

  for (let index = 0; index < 4; index += 1) {
    const start = addDays(today, -(index + 1) * 7);
    const end = addDays(today, -index * 7);
    weeklyCounts.push(
      sessions.filter((session) => {
        const date = new Date(session.date);
        return date >= start && date < end;
      }).length
    );
  }

  let streak = 0;
  for (const count of weeklyCounts) {
    if (count > 0) {
      streak += 1;
    } else {
      break;
    }
  }

  return {
    title: "训练稳定性",
    value: `${streak} 周`,
    detail: streak > 0 ? `最近 4 周分别记录了 ${weeklyCounts.join(" / ")} 次。` : "最近几周记录断掉了，重新开始也算在前进。"
  };
}

export function buildWeeklySummary(metrics: MetricResult[]) {
  const fear = metrics.find((metric) => metric.title === "恐惧趋势");
  const push = metrics.find((metric) => metric.title === "尝试强度");
  const consistency = metrics.find((metric) => metric.title === "训练稳定性");

  if (!fear || !push || !consistency) {
    return "继续记录，下一周会更清楚地看到变化。";
  }

  return `这周你在 ${consistency.value} 的节奏里继续出现，${push.value} 的尝试靠近上限难度。${fear.empty ? "恐惧趋势还在积累数据。" : "你也在慢慢变稳。"}`;
}

export function getWeeklyClimbCount(climbs: Climb[]) {
  return filterClimbsByDays(climbs, 7, 0).length;
}

export function getWeeklySessionCount(sessions: ClimbingSession[]) {
  const today = startOfDay(new Date());
  const start = addDays(today, -6);
  const end = addDays(today, 1);
  return sessions.filter((session) => {
    const date = new Date(session.date);
    return date >= start && date < end;
  }).length;
}

export function getProjectStats(project: Project, climbs: Climb[], sessions: ClimbingSession[]) {
  const relatedClimbs = climbs.filter((climb) => climb.projectId === project.id);
  const relatedSessions = sessions.filter((session) => relatedClimbs.some((climb) => climb.sessionId === session.id));
  const totalAttempts = relatedClimbs.reduce((sum, climb) => sum + (climb.attemptsCount ?? getAttemptEstimate(climb.attemptsBucket)), 0);
  const fears = relatedClimbs.map((climb) => climb.fearRating);

  return {
    totalAttempts: Math.round(totalAttempts),
    totalSessions: relatedSessions.length,
    latestFear: fears.length ? fears[fears.length - 1] : undefined,
    firstFear: fears[0]
  };
}
