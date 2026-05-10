import { Button, View } from "@tarojs/components";
import Taro, { useDidShow, useTabItemTap } from "@tarojs/taro";
import { useEffect, useState } from "react";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/common";
import { useProtectedPage } from "@/hooks/use-protected-page";
import {
  countCachedClimbs,
  downloadOpenBetaArea,
  getSavedOpenBetaAreas,
  saveOpenBetaArea
} from "@/services/openbeta";
import { OpenBetaSavedArea } from "@/types/openbeta";

function formatRelativeTime(iso: string) {
  const timestamp = new Date(iso).getTime();

  if (!Number.isFinite(timestamp)) {
    return "just now";
  }

  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));

  if (seconds < 60) {
    return `${seconds || 1} sec ago`;
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  return `${Math.round(hours / 24)} day ago`;
}

export default function CragsPage() {
  const auth = useProtectedPage();
  const [savedAreas, setSavedAreas] = useState<OpenBetaSavedArea[]>([]);
  const [refreshingUuid, setRefreshingUuid] = useState<string>();

  function loadSavedAreas() {
    setSavedAreas(getSavedOpenBetaAreas(auth.user?.id));
  }

  useEffect(loadSavedAreas, [auth.user?.id]);
  useDidShow(loadSavedAreas);
  useTabItemTap(loadSavedAreas);

  function goToSearch() {
    Taro.navigateTo({ url: "/pages/crag-search/index" });
  }

  function goToDetail(uuid: string) {
    Taro.navigateTo({ url: `/pages/crag-detail/index?uuid=${encodeURIComponent(uuid)}` });
  }

  async function refreshSavedArea(uuid: string) {
    setRefreshingUuid(uuid);

    try {
      const nextArea = await downloadOpenBetaArea(uuid);
      setSavedAreas(saveOpenBetaArea(auth.user?.id, nextArea));
      Taro.showToast({ title: "Area updated", icon: "none" });
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : "OpenBeta 更新失败", icon: "none" });
    } finally {
      setRefreshingUuid(undefined);
    }
  }

  return (
    <View className="page crags-page">
      <PageHeader title="Crags" />

      <Card>
        <View className="eyebrow-row">
          <View className="status-dot" />
          <View className="eyebrow-text">CRAGS</View>
        </View>
        <View className="crags-hero-title">Download regions and keep local climb shelves for fast logging.</View>
        <View className="card-subtitle">Saved areas power climb search, nearby crag detection, climb details, and tick badges.</View>
      </Card>

      <View className="action-row" onClick={goToSearch}>
        <View className="action-icon">↓</View>
        <View className="action-copy">
          <View className="action-title">Download a Region</View>
          <View className="action-subtitle">Browse OpenBeta regions and cache climbs locally</View>
        </View>
        <View className="chevron">›</View>
      </View>

      <SectionTitle>
        <View className="eyebrow-row">
          <View className="status-dot" />
          <View className="eyebrow-text">SAVED AREAS</View>
        </View>
      </SectionTitle>

      {savedAreas.length ? (
        <View className="stack-md">
          {savedAreas.map((item) => (
            <View key={item.area.uuid} className="saved-area-row" onClick={() => goToDetail(item.area.uuid)}>
              <View className="saved-area-card">
                <View className="row-between">
                  <View>
                    <View className="saved-area-title">{item.area.area_name}</View>
                    <View className="saved-area-meta">{item.area.totalClimbs.toLocaleString()} climbs</View>
                  </View>
                  <Button
                    className="icon-button"
                    loading={refreshingUuid === item.area.uuid}
                    onClick={(event) => {
                      event.stopPropagation();
                      void refreshSavedArea(item.area.uuid);
                    }}
                  >
                    ↻
                  </Button>
                </View>
                <View className="saved-area-footer">
                  {countCachedClimbs(item).toLocaleString()} cached routes · Updated {formatRelativeTime(item.fetchedAt)}
                </View>
              </View>
              <View className="chevron">›</View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState title="还没有保存的 OpenBeta 区域。先下载一个区域，之后可以在这里快速浏览岩场和线路。" actionText="Download a Region" onAction={goToSearch} />
      )}
    </View>
  );
}
