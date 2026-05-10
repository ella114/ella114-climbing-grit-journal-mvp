import { View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, PageHeader, SectionTitle } from "@/components/common";
import { useProtectedPage } from "@/hooks/use-protected-page";
import {
  getAreaPathLabel,
  getCachedAreaByUuid,
  getCachedClimbsForArea,
  getClimbGradeLabel,
  getClimbTypeLabel,
  getSavedOpenBetaAreaContainingArea
} from "@/services/openbeta";
import { OpenBetaSavedArea } from "@/types/openbeta";

function appendLogsReturnMarker(url: string) {
  return `${url}${url.includes("?") ? "&" : "?"}fromLogsReturn=1`;
}

function normalizeRouteUrl(url?: string) {
  return url?.startsWith("%2F") || url?.startsWith("%2f") ? decodeURIComponent(url) : url;
}

export default function CragAreaClimbsPage() {
  const auth = useProtectedPage();
  const router = useRouter<{ uuid?: string; backUrl?: string; fromLogsReturn?: string }>();
  const { uuid, backUrl, fromLogsReturn } = router.params;
  const [savedArea, setSavedArea] = useState<OpenBetaSavedArea>();
  const wasOpenedFromLogsReturn = fromLogsReturn === "1";
  const parentBackUrl = normalizeRouteUrl(backUrl);

  useEffect(() => {
    if (!uuid) {
      return;
    }

    setSavedArea(getSavedOpenBetaAreaContainingArea(auth.user?.id, uuid));
  }, [auth.user?.id, uuid]);

  const area = useMemo(() => (savedArea && uuid ? getCachedAreaByUuid(savedArea, uuid) : undefined), [savedArea, uuid]);
  const climbRows = useMemo(() => (savedArea && uuid ? getCachedClimbsForArea(savedArea, uuid) : []), [savedArea, uuid]);

  function goToClimb(areaUuid: string, climbUuid: string) {
    const currentUrl = `/pages/crag-area-climbs/index?uuid=${encodeURIComponent(uuid ?? areaUuid)}${
      parentBackUrl ? `&backUrl=${encodeURIComponent(parentBackUrl)}` : ""
    }`;
    Taro.navigateTo({
      url: `/pages/crag-climb-detail/index?areaUuid=${encodeURIComponent(areaUuid)}&climbUuid=${encodeURIComponent(climbUuid)}&backUrl=${encodeURIComponent(currentUrl)}`
    });
  }

  function handleBack() {
    if (wasOpenedFromLogsReturn && parentBackUrl) {
      Taro.redirectTo({ url: appendLogsReturnMarker(parentBackUrl) });
      return;
    }

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

  if (!savedArea || !area) {
    return (
      <View className="page">
        <PageHeader title="Cached Climbs" showBack onBack={handleBack} />
        <EmptyState title="这个子区域还没有本地缓存。请回到 Download Region 重新保存区域。" />
      </View>
    );
  }

  return (
    <View className="page">
      <PageHeader title={area.area_name} subtitle={getAreaPathLabel(area)} showBack onBack={handleBack} />

      <SectionTitle>Cached Climbs</SectionTitle>
      {climbRows.length ? (
        <View className="stack-md">
          {climbRows.map(({ climb, area: climbArea }) => (
            <View key={`${climbArea.uuid}-${climb.uuid}`} className="list-item" onClick={() => goToClimb(climbArea.uuid, climb.uuid)}>
              <View className="row-between">
                <View>
                  <View className="card-title">{climb.name}</View>
                  <View className="card-subtitle">{getAreaPathLabel(climbArea)}</View>
                </View>
                <View className="route-grade">{getClimbGradeLabel(climb)}</View>
              </View>
              <View className="inline-note">{getClimbTypeLabel(climb)}</View>
              {climb.metadata?.lat && climb.metadata?.lng ? (
                <View className="openbeta-copy">
                  {climb.metadata.lat.toFixed(5)}, {climb.metadata.lng.toFixed(5)}
                </View>
              ) : null}
              {climb.content?.location ? <View className="openbeta-copy">{climb.content.location}</View> : null}
            </View>
          ))}
        </View>
      ) : (
        <EmptyState title="这个子区域缓存里暂时没有线路。OpenBeta 可能只在更深层区域存放 climbs。" />
      )}
    </View>
  );
}
