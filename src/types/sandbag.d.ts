declare module "@openbeta/sandbag" {
  export type SandbagScore = number | [number, number];
  export type SandbagGradeBand = "unknown" | "beginner" | "intermediate" | "advanced" | "expert";

  export type SandbagScale = {
    isType: (grade: string) => boolean;
    getScore: (grade: string) => SandbagScore;
    getGrade: (score: SandbagScore) => string;
    getGradeBand: (grade: string) => SandbagGradeBand;
    displayName: string;
    name: string;
    grades: string[];
  };

  export const VScale: SandbagScale;
  export const Font: SandbagScale;
  export const French: SandbagScale;
  export const YosemiteDecimal: SandbagScale;
}
