import { Button, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { useEffect, useMemo, useState } from "react";
import { Card, EmptyState, MetricCard, PageHeader, PillRow, SectionTitle } from "@/components/common";
import { useProtectedPage } from "@/hooks/use-protected-page";
import {
  countCachedClimbs,
  downloadOpenBetaArea,
  getAreaPathLabel,
  getSavedOpenBetaArea,
  saveOpenBetaArea
} from "@/services/openbeta";
import { OpenBetaSavedArea } from "@/types/openbeta";

const DISCIPLINE_LABELS: Record<string, string> = {
  bouldering: "Boulder",
  sport: "Sport",
  trad: "Trad",
  tr: "TR",
  ice: "Ice",
  mixed: "Mixed",
  aid: "Aid"
};

export default function CragDetailPage() {
  const auth = useProtectedPage();
  const router = useRouter<{ uuid?: string; fromLogsReturn?: string }>();
  const { uuid, fromLogsReturn } = router.params;
  const [savedArea, setSavedArea] = useState<OpenBetaSavedArea>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const wasOpenedFromLogsReturn = fromLogsReturn === "1";

  useEffect(() => {
    if (!uuid) {
      return;
    }

    setSavedArea(getSavedOpenBetaArea(auth.user?.id, uuid));
  }, [auth.user?.id, uuid]);

  const cachedClimbs = savedArea ? countCachedClimbs(savedArea) : 0;
  const disciplinePills = useMemo(() => {
    const stats = savedArea?.area.aggregate?.byDiscipline || {};

    return Object.entries(stats)
      .map(([key, value]) => ({
        label: DISCIPLINE_LABELS[key] || key,
        total: value?.total || 0
      }))
      .filter((item) => item.total > 0)
      .sort((left, right) => right.total - left.total)
      .map((item) => `${item.label} ${item.total}`);
  }, [savedArea]);

  const topGrades = useMemo(
    () =>
      (savedArea?.area.aggregate?.byGrade || [])
        .filter((item) => item.label && item.count)
        .sort((left, right) => Number(right.count || 0) - Number(left.count || 0))
        .slice(0, 10)
        .map((item) => `${item.label} × ${item.count}`),
    [savedArea]
  );

  async function refreshArea() {
    if (!uuid) {
      return;
    }

    setIsRefreshing(true);

    try {
      const nextArea = await downloadOpenBetaArea(uuid);
      saveOpenBetaArea(auth.user?.id, nextArea);
      setSavedArea(nextArea);
      Taro.showToast({ title: "Area updated", icon: "none" });
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : "OpenBeta 更新失败", icon: "none" });
    } finally {
      setIsRefreshing(false);
    }
  }

  function goToSubArea(areaUuid: string) {
    const currentUrl = `/pages/crag-detail/index?uuid=${encodeURIComponent(uuid ?? areaUuid)}`;
    Taro.navigateTo({
      url: `/pages/crag-area-climbs/index?uuid=${encodeURIComponent(areaUuid)}&backUrl=${encodeURIComponent(currentUrl)}`
    });
  }

  function handleBack() {
    if (wasOpenedFromLogsReturn) {
      Taro.switchTab({ url: "/pages/crags/index" });
      return;
    }

    const pages = Taro.getCurrentPages();

    if (pages.length > 1) {
      Taro.navigateBack();
      return;
    }

    Taro.switchTab({ url: "/pages/crags/index" });
  }

  if (!savedArea) {
    return (
      <View className="page">
        <PageHeader title="Crag Detail" showBack onBack={handleBack} />
        <EmptyState title="这个区域还没有本地缓存。请先从 Download Region 搜索并保存。" />
      </View>
    );
  }

  const area = savedArea.area;
  const subAreas = (area.children || []).filter((child) => child.totalClimbs > 0);

  return (
    <View className="page crag-detail-page">
      <PageHeader
        title={area.area_name}
        subtitle={getAreaPathLabel(area)}
        showBack
        onBack={handleBack}
        action={
          <Button className="avatar-button" loading={isRefreshing} onClick={refreshArea}>
            Refresh
          </Button>
        }
      />

      <Card>
        <View className="metric-grid">
          <MetricCard metric={{ title: "OpenBeta climbs", value: area.totalClimbs.toLocaleString(), detail: "Total routes in this region." }} />
          <MetricCard metric={{ title: "Cached routes", value: cachedClimbs.toLocaleString(), detail: "Stored on this device." }} />
          <MetricCard metric={{ title: "Cached areas", value: savedArea.areas.length.toLocaleString(), detail: "Downloaded area nodes." }} />
          <MetricCard
            metric={{
              title: "Coordinates",
              value: area.metadata?.lat && area.metadata?.lng ? `${area.metadata.lat.toFixed(2)}, ${area.metadata.lng.toFixed(2)}` : "N/A",
              detail: "Approximate OpenBeta location."
            }}
          />
        </View>
      </Card>

      {disciplinePills.length ? (
        <>
          <SectionTitle>Disciplines</SectionTitle>
          <PillRow items={disciplinePills} />
        </>
      ) : null}

      {topGrades.length ? (
        <>
          <SectionTitle>Common Grades</SectionTitle>
          <PillRow items={topGrades} />
        </>
      ) : null}

      {area.content?.description || area.content?.areaLocation ? (
        <>
          <SectionTitle>OpenBeta Notes</SectionTitle>
          <Card>
            {area.content.description ? <View className="openbeta-copy">{area.content.description}</View> : null}
            {area.content.areaLocation ? <View className="openbeta-copy">{area.content.areaLocation}</View> : null}
          </Card>
        </>
      ) : null}

      <SectionTitle>Sub Areas</SectionTitle>
      {subAreas.length ? (
        <View className="stack-md">
          {subAreas.slice(0, 80).map((child) => (
            <View key={child.uuid} className="list-item" onClick={() => goToSubArea(child.uuid)}>
              <View className="row-between">
                <View>
                  <View className="card-title">{child.area_name}</View>
                  <View className="card-subtitle">{child.totalClimbs.toLocaleString()} climbs</View>
                </View>
                <View className="row">
                  {child.metadata?.leaf ? <View className="pill">Leaf</View> : null}
                  <View className="chevron">›</View>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState title="OpenBeta 没有返回有 climbs 的子区域。" />
      )}
    </View>
  );
}
