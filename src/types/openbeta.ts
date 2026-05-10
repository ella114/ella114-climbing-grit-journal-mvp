export type OpenBetaAreaMetadata = {
  lat?: number | null;
  lng?: number | null;
  leaf?: boolean;
  isDestination?: boolean;
};

export type OpenBetaAreaSummary = {
  uuid: string;
  area_name: string;
  totalClimbs: number;
  ancestors: string[];
  pathTokens: string[];
  metadata: OpenBetaAreaMetadata;
};

export type OpenBetaGradeSet = {
  yds?: string | null;
  vscale?: string | null;
  font?: string | null;
  french?: string | null;
};

export type OpenBetaClimbType = {
  trad?: boolean | null;
  sport?: boolean | null;
  bouldering?: boolean | null;
  tr?: boolean | null;
  ice?: boolean | null;
  mixed?: boolean | null;
  aid?: boolean | null;
};

export type OpenBetaClimb = {
  uuid: string;
  name: string;
  grades?: OpenBetaGradeSet | null;
  gradeContext?: string | null;
  type?: OpenBetaClimbType | null;
  metadata?: {
    lat?: number | null;
    lng?: number | null;
  } | null;
  content?: {
    description?: string | null;
    location?: string | null;
    protection?: string | null;
  } | null;
};

export type OpenBetaAreaDetail = OpenBetaAreaSummary & {
  content?: {
    description?: string | null;
    areaLocation?: string | null;
  } | null;
  aggregate?: {
    byDiscipline?: Partial<Record<keyof OpenBetaClimbType, { total: number } | null>> | null;
    byGrade?: Array<{
      label?: string | null;
      count?: number | null;
    }> | null;
  } | null;
  children?: OpenBetaAreaSummary[];
  climbs?: OpenBetaClimb[];
};

export type OpenBetaDownloadedArea = OpenBetaAreaSummary & {
  climbs?: OpenBetaClimb[];
};

export type OpenBetaSavedArea = {
  area: OpenBetaAreaDetail;
  areas: OpenBetaDownloadedArea[];
  fetchedAt: string;
  downloadLimit: number;
  source: "openbeta";
};
