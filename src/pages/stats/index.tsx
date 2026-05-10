import { Button, View } from "@tarojs/components";
import { Card, MetricCard, PageHeader, SectionTitle } from "@/components/common";
import { ShareCardModal } from "@/components/share-card-modal";
import { useBootstrapData } from "@/hooks/use-bootstrap-data";
import { useProtectedPage } from "@/hooks/use-protected-page";
import { useState } from "react";
import { ShareCard } from "@/types/domain";
import {
  buildWeeklySummary,
  calculateComfortZoneRatio,
  calculateFearTrend,
  calculateProjectPersistence,
  calculatePushRate,
  calculateSessionConsistency,
  getWeeklyClimbCount,
  getWeeklySessionCount
} from "@/utils/metrics";
import { buildWeeklyGrowthCard } from "@/utils/share-cards";

export default function StatsPage() {
  const auth = useProtectedPage();
  const { climbs, sessions, projects, isLoading } = useBootstrapData(auth.isAuthenticated && !auth.isLoading);
  const [shareCard, setShareCard] = useState<ShareCard | undefined>();
  const activeProjectCount = projects.filter((project) => project.status === "active").length;
  const metrics = [
    calculateFearTrend(climbs),
    calculatePushRate(climbs),
    calculateComfortZoneRatio(climbs),
    calculateProjectPersistence(projects, climbs, sessions),
    calculateSessionConsistency(sessions)
  ];
  const weeklySessionCount = getWeeklySessionCount(sessions);
  const weeklyClimbCount = getWeeklyClimbCount(climbs);
  const summary = buildWeeklySummary(metrics);

  function handleGenerate() {
    if (!auth.user) {
      return;
    }

    setShareCard(buildWeeklyGrowthCard(auth.user.id, weeklySessionCount, weeklyClimbCount, activeProjectCount, metrics, summary));
  }

  return (
    <View className="page">
      <PageHeader title="Stats / Grit" subtitle="本周成长卡只能从这里生成，首页只做提醒。" />

      <Card>
        <View className="card-title">本周成长模块</View>
        <View className="hero-value">{weeklySessionCount} 次</View>
        <View className="card-subtitle">本周新增 {weeklyClimbCount} 条 Climb，当前 Active Project {activeProjectCount} 个。</View>
        <View className="divider" />
        <View>{summary}</View>
        <Button className="primary-button" style={{ marginTop: "20px" }} onClick={handleGenerate}>
          Generate Weekly Growth Card
        </Button>
      </Card>

      <SectionTitle>五个确定性指标</SectionTitle>
      <View className="metric-grid">
        {(isLoading ? [] : metrics).map((metric) => (
          <MetricCard key={metric.title} metric={metric} />
        ))}
      </View>
      {isLoading ? <EmptyStatePlaceholder /> : null}
      <ShareCardModal visible={Boolean(shareCard)} card={shareCard} onClose={() => setShareCard(undefined)} />
    </View>
  );
}

function EmptyStatePlaceholder() {
  return <View className="inline-note">正在加载统计数据…</View>;
}
