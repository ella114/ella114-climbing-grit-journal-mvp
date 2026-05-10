import { Font, French, VScale, YosemiteDecimal } from "@openbeta/sandbag";
import { GradeBand, GradeInfo, GradeSystem } from "@/types/domain";

type SandbagScale = {
  isType: (grade: string) => boolean;
  getScore: (grade: string) => number | [number, number];
  getGradeBand: (grade: string) => GradeBand | "unknown";
};

const GRADE_SCALE_BY_SYSTEM: Partial<Record<GradeSystem, SandbagScale>> = {
  v_scale: VScale,
  font: Font,
  french: French,
  yds: YosemiteDecimal
};

const FONT_LOW_GRADE_FALLBACK: Record<string, number> = {
  "4": 47,
  "5": 52,
  "5+": 57
};

function averageScore(score: number | [number, number]) {
  return Array.isArray(score) ? (score[0] + score[1]) / 2 : score;
}

function normalizeGradeForSandbag(gradeLabel: string, gradeSystem?: GradeSystem) {
  const trimmed = gradeLabel.trim();

  if (gradeSystem === "font" || (!gradeSystem && /^\d[A-Ca-c][+]?$/i.test(trimmed))) {
    return trimmed.toLowerCase();
  }

  if (gradeSystem === "french" || (!gradeSystem && /^\d[a-c][+]?$/i.test(trimmed))) {
    return trimmed.toLowerCase();
  }

  return trimmed;
}

function getScaleForSystem(gradeSystem?: GradeSystem) {
  return gradeSystem ? GRADE_SCALE_BY_SYSTEM[gradeSystem] : undefined;
}

function getSandbagScore(gradeLabel: string, gradeSystem?: GradeSystem) {
  const scale = getScaleForSystem(gradeSystem);
  const grade = normalizeGradeForSandbag(gradeLabel, gradeSystem);

  if (!scale || !scale.isType(grade)) {
    return undefined;
  }

  const score = scale.getScore(grade);
  const numericScore = averageScore(score);

  return numericScore >= 0 ? numericScore : undefined;
}

export function detectGradeSystem(gradeLabel: string): GradeSystem | undefined {
  const raw = gradeLabel.trim();
  const fontGrade = normalizeGradeForSandbag(raw, "font");
  const frenchGrade = normalizeGradeForSandbag(raw, "french");

  if (VScale.isType(raw) && getSandbagScore(raw, "v_scale") !== undefined) {
    return "v_scale";
  }

  if (Font.isType(fontGrade) && getSandbagScore(fontGrade, "font") !== undefined) {
    return "font";
  }

  if (YosemiteDecimal.isType(raw) && getSandbagScore(raw, "yds") !== undefined) {
    return "yds";
  }

  if (French.isType(frenchGrade) && getSandbagScore(frenchGrade, "french") !== undefined) {
    return "french";
  }

  if (FONT_LOW_GRADE_FALLBACK[raw] !== undefined) {
    return "font";
  }

  return undefined;
}

export function normalizeGrade(gradeLabel: string, gradeSystem?: GradeSystem) {
  const system = gradeSystem ?? detectGradeSystem(gradeLabel);

  if (system === "font" && FONT_LOW_GRADE_FALLBACK[gradeLabel.trim()] !== undefined) {
    return FONT_LOW_GRADE_FALLBACK[gradeLabel.trim()];
  }

  return getSandbagScore(gradeLabel, system);
}

export function getGradeBand(grade: GradeInfo): GradeBand {
  const system = grade.gradeSystem ?? detectGradeSystem(grade.gradeLabel);
  const scale = getScaleForSystem(system);
  const normalizedGradeLabel = normalizeGradeForSandbag(grade.gradeLabel, system);

  if (!scale) {
    return "unknown";
  }

  if (system === "font" && FONT_LOW_GRADE_FALLBACK[grade.gradeLabel.trim()] !== undefined) {
    const value = FONT_LOW_GRADE_FALLBACK[grade.gradeLabel.trim()];

    if (value < 50) return "beginner";
    if (value < 60) return "intermediate";
    return "advanced";
  }

  const band = scale.getGradeBand(normalizedGradeLabel);
  return band === "unknown" ? "unknown" : band;
}

export function canCompareGrades(a: GradeInfo, b: GradeInfo) {
  return a.normalizedGradeValue !== undefined && b.normalizedGradeValue !== undefined;
}

export function compareGrades(a: GradeInfo, b: GradeInfo) {
  if (!canCompareGrades(a, b)) {
    return undefined;
  }

  if (a.normalizedGradeValue === b.normalizedGradeValue) {
    return 0;
  }

  return (a.normalizedGradeValue ?? 0) > (b.normalizedGradeValue ?? 0) ? 1 : -1;
}

export function buildGradeInfo(gradeLabel: string, gradeSystem?: GradeSystem): GradeInfo {
  const normalizedGradeValue = normalizeGrade(gradeLabel, gradeSystem);
  const info: GradeInfo = {
    gradeLabel,
    gradeSystem: gradeSystem ?? detectGradeSystem(gradeLabel),
    normalizedGradeValue
  };
  info.gradeBand = getGradeBand(info);
  return info;
}
