import { Button, View } from "@tarojs/components";
import Taro, { useTabItemTap } from "@tarojs/taro";
import { Card, EmptyState, MetricCard, PageHeader, PillRow, SectionTitle } from "@/components/common";
import { useBootstrapData } from "@/hooks/use-bootstrap-data";
import { useProtectedPage } from "@/hooks/use-protected-page";
import { switchToLogs } from "@/utils/logs-navigation";
import {
  calculateFearTrend,
  calculatePushRate,
  calculateSessionConsistency,
  getProjectStats,
  getWeeklySessionCount
} from "@/utils/metrics";
import { compareSessionsByRecentActivity, formatSessionActivityTime } from "@/utils/session-order";

export default function HomePage() {
  const auth = useProtectedPage();
  const { sessions, climbs, projects, isLoading, reload } = useBootstrapData(auth.isAuthenticated && !auth.isLoading);
  useTabItemTap(() => {
    void reload();
  });

  const activeProjects = projects.filter((project) => project.status === "active").slice(0, 3);
  const latestSession = [...sessions].sort(compareSessionsByRecentActivity)[0];
  const weeklySessions = getWeeklySessionCount(sessions);
  const metrics = [calculateFearTrend(climbs), calculatePushRate(climbs), calculateSessionConsistency(sessions)];

  function goToTab(url: string) {
    Taro.switchTab({ url });
  }

  function goToMe() {
    Taro.navigateTo({ url: "/pages/me/index" });
  }

  function goToCalendar() {
    Taro.navigateTo({ url: "/pages/calendar/index" });
  }

  function getSessionDisciplineLabel() {
    if (!latestSession) {
      return "";
    }

    return latestSession.discipline === "other" ? latestSession.disciplineOtherText ?? "其他" : latestSession.discipline;
  }

  function getLatestSessionSubtitle() {
    if (!latestSession) {
      return "";
    }

    const timeLabel = formatSessionActivityTime(latestSession);
    return [latestSession.date, timeLabel, getSessionDisciplineLabel()].filter(Boolean).join(" · ");
  }

  return (
    <View className="page">
      <PageHeader
        title={`今天爬了吗，${auth.user?.nickname ?? "你"}？`}
        subtitle={`这周你已经记录了 ${weeklySessions} 次 Session。`}
        action={
          <View className="row">
            <Button className="avatar-button" onClick={goToCalendar}>
              日历
            </Button>
            <Button className="avatar-button" onClick={goToMe}>
              我的
            </Button>
          </View>
        }
      />

      <Card>
        <View className="card-title">快速开始</View>
        <View className="hero-value">Start Session</View>
        <View className="card-subtitle">Record your first climb. Not just grades, but fear, attempts, and persistence too.</View>
        <Button className="primary-button" onClick={() => void switchToLogs("session")}>
          开始记录
        </Button>
      </Card>

      <Card>
        <View className="row-between">
          <View>
            <View className="card-title">本周成长提醒</View>
            <View className="card-subtitle">本周成长数据已准备好。去 Stats 查看完整复盘。</View>
          </View>
          <Button className="secondary-button" onClick={() => goToTab("/pages/stats/index")}>
            查看本周成长
          </Button>
        </View>
      </Card>

      <SectionTitle>当前 Project</SectionTitle>
      {!isLoading && activeProjects.length ? (
        activeProjects.map((project) => {
          const stats = getProjectStats(project, climbs, sessions);
          return (
            <Card key={project.id}>
              <View className="row-between">
                <View>
                  <View className="card-title">{project.title}</View>
                  <View className="card-subtitle">
                    {project.gradeLabel} · {project.locationName ?? "未填写地点"}
                  </View>
                </View>
                <Button className="ghost-button" onClick={() => void switchToLogs("project")}>
                  查看
                </Button>
              </View>
              <View className="metric-grid" style={{ marginTop: "16px" }}>
                <MetricCard metric={{ title: "累计尝试", value: `${stats.totalAttempts}`, detail: "一次次回来，就是成长的证据。" }} />
                <MetricCard metric={{ title: "累计 Session", value: `${stats.totalSessions}`, detail: "Track the project that keeps asking for another try." }} />
              </View>
              <View style={{ marginTop: "16px" }}>
                <PillRow items={project.tags} />
              </View>
            </Card>
          );
        })
      ) : (
        <EmptyState title={isLoading ? "正在加载你的 Project…" : "还没有 Active Project。先把一条想反复回来的线留下来。"} />
      )}

      <SectionTitle>最近一次 Session</SectionTitle>
      {latestSession ? (
        <Card>
          <View className="card-title">{latestSession.locationName ?? "未填写地点"}</View>
          <View className="card-subtitle">{getLatestSessionSubtitle()}</View>
          <View className="divider" />
          <View>{latestSession.summary ?? "今天的进步，可能更像坚持。"}</View>
        </Card>
      ) : (
        <EmptyState title={isLoading ? "正在加载最近记录…" : "记录你的第一次攀岩，不只是难度，也包括恐惧、尝试和坚持。"} />
      )}

      <SectionTitle>Grit 快照</SectionTitle>
      <View className="metric-grid">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} metric={metric} />
        ))}
      </View>
    </View>
  );
}
