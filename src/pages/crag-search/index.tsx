import { Button, Input, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, PageHeader, SectionTitle } from "@/components/common";
import { useProtectedPage } from "@/hooks/use-protected-page";
import {
  downloadOpenBetaArea,
  getOpenBetaAreaChildren,
  getOpenBetaDownloadableRegions,
  OpenBetaDownloadableRegionGroup,
  saveOpenBetaArea,
  searchOpenBetaAreas
} from "@/services/openbeta";
import { OpenBetaAreaSummary } from "@/types/openbeta";

function AreaResult({
  area,
  isDownloading,
  onDownload
}: {
  area: OpenBetaAreaSummary;
  isDownloading: boolean;
  onDownload: (area: OpenBetaAreaSummary) => void;
}) {
  return (
    <View className="download-region-row">
      <View className="action-icon">↓</View>
      <View className="download-region-copy">
        <View className="download-region-title">{area.area_name}</View>
        <View className="download-region-subtitle">Download climb cache · {area.totalClimbs.toLocaleString()} climbs</View>
      </View>
      <Button className="download-button" loading={isDownloading} onClick={() => onDownload(area)}>
        Download
      </Button>
    </View>
  );
}

function CountryGroup({
  group,
  downloadingUuid,
  onDownload
}: {
  group: OpenBetaDownloadableRegionGroup;
  downloadingUuid?: string;
  onDownload: (area: OpenBetaAreaSummary) => void;
}) {
  return (
    <View className="download-country-group">
      <View className="eyebrow-row download-country-title">
        <View className="status-dot" />
        <View className="eyebrow-text">{group.country.area_name.toUpperCase()}</View>
      </View>
      <View className="stack-sm">
        {group.areas.map((area) => (
          <AreaResult key={area.uuid} area={area} isDownloading={downloadingUuid === area.uuid} onDownload={onDownload} />
        ))}
      </View>
    </View>
  );
}

export default function CragSearchPage() {
  const auth = useProtectedPage();
  const [query, setQuery] = useState("");
  const [resultGroups, setResultGroups] = useState<OpenBetaDownloadableRegionGroup[]>([]);
  const [downloadableGroups, setDownloadableGroups] = useState<OpenBetaDownloadableRegionGroup[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingRegions, setIsLoadingRegions] = useState(false);
  const [downloadingUuid, setDownloadingUuid] = useState<string>();

  const visibleGroups = useMemo(
    () => (resultGroups.length ? resultGroups : downloadableGroups).filter((group) => group.areas.length),
    [downloadableGroups, resultGroups]
  );

  useEffect(() => {
    if (!auth.isAuthenticated || auth.isLoading) {
      return;
    }

    setIsLoadingRegions(true);
    getOpenBetaDownloadableRegions()
      .then((response) => setDownloadableGroups(response.groups))
      .catch(() => undefined)
      .finally(() => setIsLoadingRegions(false));
  }, [auth.isAuthenticated, auth.isLoading]);

  async function buildSearchGroups(areas: OpenBetaAreaSummary[]) {
    const nonCountryAreas = areas.filter((area) => area.totalClimbs > 0 && area.ancestors.length === 2);
    const countryAreas = areas.filter((area) => area.totalClimbs > 0 && area.ancestors.length < 2);
    const countryGroups = await Promise.all(
      countryAreas.map(async (country) => {
        const response = await getOpenBetaAreaChildren(country.uuid);
        return {
          country,
          areas: response.areas.filter((area) => area.totalClimbs > 0)
        };
      })
    );

    const groupedByCountry = new Map<string, OpenBetaDownloadableRegionGroup>();

    countryGroups.forEach((group) => {
      if (group.areas.length) {
        groupedByCountry.set(group.country.uuid, group);
      }
    });

    nonCountryAreas.forEach((area) => {
      const countryName = area.pathTokens?.[0] || "OpenBeta";
      const countryUuid = area.ancestors[0] || countryName;
      const existingGroup = groupedByCountry.get(countryUuid);

      if (existingGroup) {
        if (!existingGroup.areas.some((item) => item.uuid === area.uuid)) {
          existingGroup.areas.push(area);
          existingGroup.areas.sort((left, right) => left.area_name.localeCompare(right.area_name));
        }
        return;
      }

      groupedByCountry.set(countryUuid, {
        country: {
          uuid: countryUuid,
          area_name: countryName,
          totalClimbs: 0,
          ancestors: [countryUuid],
          pathTokens: [countryName],
          metadata: {}
        },
        areas: [area]
      });
    });

    return [...groupedByCountry.values()].sort((left, right) => left.country.area_name.localeCompare(right.country.area_name));
  }

  async function handleSearch() {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      Taro.showToast({ title: "至少输入 2 个字符", icon: "none" });
      return;
    }

    setIsSearching(true);

    try {
      const response = await searchOpenBetaAreas(trimmed);
      setResultGroups(await buildSearchGroups(response.areas));
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : "OpenBeta 搜索失败", icon: "none" });
    } finally {
      setIsSearching(false);
    }
  }

  async function handleDownload(area: OpenBetaAreaSummary) {
    setDownloadingUuid(area.uuid);

    try {
      const savedArea = await downloadOpenBetaArea(area.uuid);
      saveOpenBetaArea(auth.user?.id, savedArea);
      Taro.showToast({ title: "Region saved", icon: "none" });
      Taro.redirectTo({ url: `/pages/crag-detail/index?uuid=${encodeURIComponent(savedArea.area.uuid)}` });
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : "区域下载失败", icon: "none" });
    } finally {
      setDownloadingUuid(undefined);
    }
  }

  return (
    <View className="page">
      <PageHeader title="Download Region" subtitle="Search OpenBeta worldwide and save a region to this device." showBack />

      <View className="search-panel">
        <Input
          className="input search-input"
          value={query}
          placeholder="Queensland, Connecticut, British Columbia..."
          confirmType="search"
          onInput={(event) => setQuery(event.detail.value)}
          onConfirm={handleSearch}
        />
        <Button className="primary-button search-button" loading={isSearching} onClick={handleSearch}>
          Search
        </Button>
      </View>

      <SectionTitle>{resultGroups.length ? "Search Results" : "Downloadable Regions"}</SectionTitle>
      {isLoadingRegions && !resultGroups.length ? (
        <EmptyState title="正在加载 OpenBeta 可下载区域…" />
      ) : visibleGroups.length ? (
        <View className="stack-md">
          {visibleGroups.map((group) => (
            <CountryGroup key={group.country.uuid} group={group} downloadingUuid={downloadingUuid} onDownload={handleDownload} />
          ))}
        </View>
      ) : (
        <EmptyState title="没有找到可下载区域。请输入国家或州/省名，只会显示第一层且有 climbs 的区域。" />
      )}
    </View>
  );
}
