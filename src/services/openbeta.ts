import { apiRequest } from "./api";
import { readStorage, writeStorage } from "./storage";
import { OpenBetaAreaSummary, OpenBetaClimb, OpenBetaDownloadedArea, OpenBetaSavedArea } from "@/types/openbeta";

const OPENBETA_SAVED_AREAS_STORAGE_PREFIX = "openbeta.saved-areas.v1";

type AreaListResponse = {
  areas: OpenBetaAreaSummary[];
};

export type OpenBetaDownloadableRegionGroup = {
  country: OpenBetaAreaSummary;
  areas: OpenBetaAreaSummary[];
};

type DownloadableRegionsResponse = {
  groups: OpenBetaDownloadableRegionGroup[];
};

function getStorageKey(userId?: string) {
  return `${OPENBETA_SAVED_AREAS_STORAGE_PREFIX}.${userId || "guest"}`;
}

export function getSavedOpenBetaAreas(userId?: string) {
  return readStorage<OpenBetaSavedArea[]>(getStorageKey(userId), []);
}

export function getSavedOpenBetaArea(userId: string | undefined, uuid: string) {
  return getSavedOpenBetaAreas(userId).find((item) => item.area.uuid === uuid);
}

export function getSavedOpenBetaAreaContainingArea(userId: string | undefined, areaUuid: string) {
  return getSavedOpenBetaAreas(userId).find(
    (item) =>
      item.area.uuid === areaUuid ||
      item.area.children?.some((area) => area.uuid === areaUuid) ||
      item.areas.some((area) => area.uuid === areaUuid)
  );
}

export function getSavedOpenBetaAreaContainingClimb(userId: string | undefined, climbUuid: string) {
  return getSavedOpenBetaAreas(userId).find((item) =>
    flattenCachedClimbs(item).some(({ climb }) => climb.uuid === climbUuid)
  );
}

export function saveOpenBetaArea(userId: string | undefined, area: OpenBetaSavedArea) {
  const current = getSavedOpenBetaAreas(userId);
  const next = [area, ...current.filter((item) => item.area.uuid !== area.area.uuid)].sort((left, right) =>
    right.fetchedAt.localeCompare(left.fetchedAt)
  );

  writeStorage(getStorageKey(userId), next);
  return next;
}

export function searchOpenBetaAreas(query: string, limit = 20) {
  return apiRequest<AreaListResponse>(`/openbeta/areas/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

export function getOpenBetaCountries() {
  return apiRequest<AreaListResponse>("/openbeta/countries");
}

export function getOpenBetaDownloadableRegions() {
  return apiRequest<DownloadableRegionsResponse>("/openbeta/downloadable-regions");
}

export function getOpenBetaAreaChildren(uuid: string) {
  return apiRequest<AreaListResponse>(`/openbeta/areas/${encodeURIComponent(uuid)}/children`);
}

export function downloadOpenBetaArea(uuid: string) {
  return apiRequest<OpenBetaSavedArea>(`/openbeta/areas/${encodeURIComponent(uuid)}/download`);
}

export function countCachedClimbs(savedArea: OpenBetaSavedArea) {
  const directClimbs = savedArea.area.climbs?.length || 0;
  const nestedClimbs = savedArea.areas.reduce((total, area) => total + (area.climbs?.length || 0), 0);
  return directClimbs + nestedClimbs;
}

export function getAreaPathLabel(area: Pick<OpenBetaAreaSummary, "pathTokens" | "area_name">) {
  return area.pathTokens?.length ? area.pathTokens.join(" / ") : area.area_name;
}

export function getClimbGradeLabel(climb: OpenBetaClimb) {
  return climb.grades?.vscale || climb.grades?.yds || climb.grades?.font || climb.grades?.french || "未标级";
}

export function getClimbTypeLabel(climb: OpenBetaClimb) {
  const type = climb.type || {};
  const labels: string[] = [];

  if (type.bouldering) labels.push("Boulder");
  if (type.sport) labels.push("Sport");
  if (type.tr) labels.push("TR");
  if (type.trad) labels.push("Trad");
  if (type.ice) labels.push("Ice");
  if (type.mixed) labels.push("Mixed");
  if (type.aid) labels.push("Aid");

  return labels.length ? labels.join(" / ") : "Route";
}

export function getClimbGradeSystemLabel(climb: OpenBetaClimb) {
  if (climb.grades?.vscale) return "V-Scale";
  if (climb.grades?.yds) return "YDS";
  if (climb.grades?.font) return "Font";
  if (climb.grades?.french) return "French";
  return "Unknown";
}

export function flattenCachedClimbs(savedArea: OpenBetaSavedArea) {
  const rows: Array<{
    climb: OpenBetaClimb;
    area: OpenBetaDownloadedArea | OpenBetaSavedArea["area"];
  }> = [];

  savedArea.area.climbs?.forEach((climb) => rows.push({ climb, area: savedArea.area }));
  savedArea.areas.forEach((area) => {
    area.climbs?.forEach((climb) => rows.push({ climb, area }));
  });

  return rows;
}

function isAreaSameOrDescendant(area: Pick<OpenBetaAreaSummary, "uuid" | "ancestors">, areaUuid: string) {
  return area.uuid === areaUuid || area.ancestors?.includes(areaUuid);
}

export function getCachedAreaByUuid(savedArea: OpenBetaSavedArea, areaUuid: string) {
  if (savedArea.area.uuid === areaUuid) {
    return savedArea.area;
  }

  return savedArea.areas.find((area) => area.uuid === areaUuid) || savedArea.area.children?.find((area) => area.uuid === areaUuid);
}

export function getCachedClimbsForArea(savedArea: OpenBetaSavedArea, areaUuid: string) {
  return flattenCachedClimbs(savedArea).filter(({ area }) => isAreaSameOrDescendant(area, areaUuid));
}

export function getCachedClimbByUuid(savedArea: OpenBetaSavedArea, climbUuid: string) {
  return flattenCachedClimbs(savedArea).find(({ climb }) => climb.uuid === climbUuid);
}
