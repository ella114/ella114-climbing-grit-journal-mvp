import { Button, Map, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { useEffect, useMemo, useState } from "react";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/common";
import { useProtectedPage } from "@/hooks/use-protected-page";
import {
  getAreaPathLabel,
  getCachedAreaByUuid,
  getCachedClimbByUuid,
  getClimbGradeLabel,
  getClimbGradeSystemLabel,
  getClimbTypeLabel,
  getSavedOpenBetaAreaContainingClimb
} from "@/services/openbeta";
import { OpenBetaAreaSummary, OpenBetaSavedArea } from "@/types/openbeta";
import { wgs84ToGcj02 } from "@/utils/coordinates";
import { navigateToLogEditor } from "@/utils/logs-navigation";
import type { ClimbingSession, GradeSystem } from "@/types/domain";
import type { OpenBetaLogPrefill } from "@/utils/logs-navigation";

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="fact-row">
      <View className="fact-label">{label}</View>
      <View className="fact-value">{value}</View>
    </View>
  );
}

function getParentArea(savedArea: OpenBetaSavedArea, area: OpenBetaAreaSummary) {
  const parentUuid = area.ancestors?.length > 1 ? area.ancestors[area.ancestors.length - 2] : undefined;
  return parentUuid ? getCachedAreaByUuid(savedArea, parentUuid) : undefined;
}

function getOpenBetaGradeSystem(climb: NonNullable<ReturnType<typeof getCachedClimbByUuid>>["climb"]): GradeSystem | undefined {
  if (climb.grades?.vscale) return "v_scale";
  if (climb.grades?.yds) return "yds";
  if (climb.grades?.font) return "font";
  if (climb.grades?.french) return "french";
  return undefined;
}

function getOpenBetaDiscipline(climb: NonNullable<ReturnType<typeof getCachedClimbByUuid>>["climb"]): ClimbingSession["discipline"] {
  if (climb.type?.bouldering) return "bouldering";
  if (climb.type?.tr) return "top_rope";
  if (climb.type?.sport || climb.type?.trad) return "outdoor";
  return "outdoor";
}

function buildOpenBetaNotes(climb: NonNullable<ReturnType<typeof getCachedClimbByUuid>>["climb"]) {
  return [
    climb.content?.description ? `Description: ${climb.content.description}` : undefined,
    climb.content?.protection ? `Protection: ${climb.content.protection}` : undefined,
    climb.content?.location ? `Location: ${climb.content.location}` : undefined
  ]
    .filter(Boolean)
    .join("\n\n");
}

function appendLogsReturnMarker(url: string) {
  return `${url}${url.includes("?") ? "&" : "?"}fromLogsReturn=1`;
}

function normalizeRouteUrl(url?: string) {
  return url?.startsWith("%2F") || url?.startsWith("%2f") ? decodeURIComponent(url) : url;
}

export default function CragClimbDetailPage() {
  const auth = useProtectedPage();
  const router = useRouter<{ areaUuid?: string; climbUuid?: string; fromLogsReturn?: string; backUrl?: string }>();
  const { areaUuid, climbUuid, fromLogsReturn, backUrl } = router.params;
  const [savedArea, setSavedArea] = useState<OpenBetaSavedArea>();

  useEffect(() => {
    if (!climbUuid) {
      return;
    }

    setSavedArea(getSavedOpenBetaAreaContainingClimb(auth.user?.id, climbUuid));
  }, [auth.user?.id, climbUuid]);

  const row = useMemo(() => (savedArea && climbUuid ? getCachedClimbByUuid(savedArea, climbUuid) : undefined), [savedArea, climbUuid]);
  const area = useMemo(
    () => (savedArea && areaUuid ? getCachedAreaByUuid(savedArea, areaUuid) : row?.area),
    [areaUuid, row?.area, savedArea]
  );
  const parentArea = useMemo(() => (savedArea && area ? getParentArea(savedArea, area) : undefined), [area, savedArea]);

  if (!savedArea || !row || !area) {
    return (
      <View className="page">
        <PageHeader title="Climb Detail" showBack />
        <EmptyState title="这条 climb 还没有本地缓存。请回到 Download Region 重新保存区域。" />
      </View>
    );
  }

  const climb = row.climb;
  const currentArea = area;
  const latitude = climb.metadata?.lat ?? area.metadata?.lat;
  const longitude = climb.metadata?.lng ?? area.metadata?.lng;
  const hasCoordinates = typeof latitude === "number" && typeof longitude === "number";
  const mapCoordinate = hasCoordinates ? wgs84ToGcj02(latitude, longitude) : undefined;
  const coordinateSource = typeof climb.metadata?.lat === "number" && typeof climb.metadata?.lng === "number" ? "线路坐标" : "区域坐标";
  const gradeContext = climb.gradeContext || area.pathTokens?.[0] || "OpenBeta";
  const gradeLabel = getClimbGradeLabel(climb);
  const gradeSystem = getOpenBetaGradeSystem(climb);
  const locationName = getAreaPathLabel(area);
  const wasOpenedFromLogsReturn = fromLogsReturn === "1";
  const parentBackUrl = normalizeRouteUrl(backUrl);
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

  function openInMaps() {
    if (!mapCoordinate) {
      Taro.showToast({ title: "没有可用坐标", icon: "none" });
      return;
    }

    Taro.openLocation({
      latitude: mapCoordinate.latitude,
      longitude: mapCoordinate.longitude,
      name: climb.name,
      address: getAreaPathLabel(currentArea),
      scale: 15
    });
  }

  function copyCoordinates() {
    if (!mapCoordinate) {
      return;
    }

    Taro.setClipboardData({ data: `${mapCoordinate.latitude}, ${mapCoordinate.longitude}` });
  }

  function buildLogPrefill(target: "session" | "project"): OpenBetaLogPrefill {
    return {
      id: `${target}-${climb.uuid}-${Date.now()}`,
      target,
      routeReferenceId: climb.uuid,
      routeName: climb.name,
      locationName,
      gradeLabel: gradeLabel === "未标级" ? undefined : gradeLabel,
      gradeSystem,
      discipline: getOpenBetaDiscipline(climb),
      climbTypeLabel: getClimbTypeLabel(climb),
      betaNotes: buildOpenBetaNotes(climb) || undefined,
      latitude: mapCoordinate?.latitude,
      longitude: mapCoordinate?.longitude,
      returnUrl: `/pages/crag-climb-detail/index?areaUuid=${encodeURIComponent(currentArea.uuid)}&climbUuid=${encodeURIComponent(climb.uuid)}${
        parentBackUrl ? `&backUrl=${encodeURIComponent(parentBackUrl)}` : ""
      }`
    };
  }

  function addOpenBetaSession() {
    void navigateToLogEditor("session", { openBetaPrefill: buildLogPrefill("session") });
  }

  function addOpenBetaProject() {
    void navigateToLogEditor("project", { openBetaPrefill: buildLogPrefill("project") });
  }

  return (
    <View className="page climb-detail-page">
      <PageHeader title={climb.name} subtitle={getAreaPathLabel(area)} showBack onBack={handleBack} />

      <Card>
        <View className="climb-log-actions">
          <View>
            <View className="eyebrow-row">
              <View className="status-dot blue" />
              <View className="eyebrow-text">LOG THIS CLIMB</View>
            </View>
            <View className="card-title climb-log-title">把 OpenBeta 信息带入你的记录</View>
            <View className="card-subtitle">已知的线路名、地点、难度和 OpenBeta ID 会自动填写并锁定。</View>
          </View>
          <View className="climb-log-button-row">
            <Button className="primary-button climb-log-button" onClick={addOpenBetaSession}>
              + Session
            </Button>
            <Button className="secondary-button climb-log-button" onClick={addOpenBetaProject}>
              + Project
            </Button>
          </View>
        </View>
      </Card>

      <SectionTitle>
        <View className="eyebrow-row">
          <View className="status-dot blue" />
          <View className="eyebrow-text">PROBLEM FACTS</View>
        </View>
      </SectionTitle>
      <Card>
        <FactRow label="Grade" value={gradeLabel} />
        <FactRow label="Grade system" value={getClimbGradeSystemLabel(climb)} />
        <FactRow label="Grade context" value={gradeContext} />
        <FactRow label="Location" value="Saved for crag detection" />

        <View className="location-stack">
          <View className="location-row">
            <View className="location-icon">⌖</View>
            <View>
              <View className="location-title">{area.area_name}</View>
              <View className="location-subtitle">{area.totalClimbs.toLocaleString()} climbs</View>
            </View>
          </View>
          {parentArea ? (
            <View className="location-row">
              <View className="location-icon folder">▰</View>
              <View>
                <View className="location-title">{parentArea.area_name}</View>
                <View className="location-subtitle">{parentArea.totalClimbs.toLocaleString()} climbs</View>
              </View>
            </View>
          ) : null}
        </View>
      </Card>

      <SectionTitle>
        <View className="eyebrow-row">
          <View className="status-dot" />
          <View className="eyebrow-text">MAP</View>
        </View>
      </SectionTitle>
      <Card>
        {mapCoordinate ? (
          <>
            <Map className="openbeta-map" latitude={mapCoordinate.latitude} longitude={mapCoordinate.longitude} scale={15} onError={() => undefined} />
            <View className="map-meta">
              {coordinateSource} · 已按微信地图使用 GCJ-02 坐标
              <View>
                {mapCoordinate.latitude.toFixed(6)}, {mapCoordinate.longitude.toFixed(6)}
              </View>
            </View>
            <Button className="ghost-button map-button" onClick={copyCoordinates}>
              复制坐标
            </Button>
            <Button className="secondary-button map-button" onClick={openInMaps}>
              Open in Maps
            </Button>
          </>
        ) : (
          <EmptyState title="OpenBeta 没有提供这条 climb 的坐标。" />
        )}
      </Card>

      <SectionTitle>
        <View className="eyebrow-row">
          <View className="status-dot blue" />
          <View className="eyebrow-text">OPENBETA NOTES</View>
        </View>
      </SectionTitle>
      <Card>
        {climb.content?.description ? (
          <View className="note-block blue">
            <View className="note-label">DESCRIPTION</View>
            <View className="note-copy">{climb.content.description}</View>
          </View>
        ) : null}
        {climb.content?.protection ? (
          <View className="note-block amber">
            <View className="note-label">PROTECTION</View>
            <View className="note-copy">{climb.content.protection}</View>
          </View>
        ) : null}
        {!climb.content?.description && !climb.content?.protection ? <EmptyState title="OpenBeta 暂时没有 notes。" /> : null}
      </Card>
    </View>
  );
}
