export type GradeSystem =
  | "v_scale"
  | "font"
  | "french"
  | "yds"
  | "uiaa"
  | "ewbank"
  | "color"
  | "custom";

export type GradeBand = "beginner" | "intermediate" | "advanced" | "expert" | "unknown";

export type User = {
  id: string;
  nickname?: string;
  avatarUrl?: string;
  gradePreference: "v_scale" | "french" | "yds" | "color";
  createdAt: string;
  updatedAt: string;
};

export type Location = {
  id: string;
  name: string;
  type: "user_created" | "verified_gym" | "outdoor_crag" | "training_board";
  parentLocationId?: string;
  externalProvider?: "openbeta" | "custom";
  externalAreaId?: string;
  lat?: number;
  lng?: number;
  city?: string;
  region?: string;
  country?: string;
  address?: string;
  verifiedStatus: "unverified" | "verified";
  createdAt: string;
  updatedAt: string;
};

export type RouteReference = {
  id: string;
  provider: "user_created" | "openbeta" | "gym_route" | "board_problem" | "outdoor_route" | "custom";
  externalId?: string;
  externalUrl?: string;
  routeName?: string;
  areaName?: string;
  locationName?: string;
  lat?: number;
  lng?: number;
  discipline?: "bouldering" | "sport" | "trad" | "top_rope" | "lead" | "training_board" | "ice" | "mixed" | "aid" | "other";
  gradeLabel?: string;
  gradeSystem?: GradeSystem;
  normalizedGradeValue?: number;
  gradeBand?: GradeBand;
  tags: string[];
  sourceLicense?: string;
  fetchedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type GradeInfo = {
  gradeLabel: string;
  gradeSystem?: GradeSystem;
  normalizedGradeValue?: number;
  gradeBand?: GradeBand;
  isGradeEstimated?: boolean;
};

export type ClimbingSession = {
  id: string;
  userId: string;
  date: string;
  locationId?: string;
  locationName?: string;
  disciplineOtherText?: string;
  durationMinutes?: number;
  energyRating?: 1 | 2 | 3 | 4 | 5;
  fatigueRating?: 1 | 2 | 3 | 4 | 5;
  moodRating?: 1 | 2 | 3 | 4 | 5;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  discipline: "bouldering" | "top_rope" | "lead" | "training_board" | "outdoor" | "other";
};

export type Climb = {
  id: string;
  userId: string;
  sessionId: string;
  locationId?: string;
  projectId?: string;
  routeReferenceId?: string;
  source: "user_created" | "openbeta_route" | "gym_route" | "board_problem" | "outdoor_route";
  linkedRouteId?: string;
  gradeLabel: string;
  gradeSystem?: GradeSystem;
  normalizedGradeValue?: number;
  outcome: "sent" | "not_sent" | "in_progress";
  ascentStyle?: "onsight" | "flash" | "redpoint" | "pinkpoint" | "headpoint" | "top_rope_clean" | "repeat" | "send" | "aid";
  betaKnowledge?: "none" | "watched_others" | "heard_beta" | "read_beta" | "previous_attempt" | "unknown";
  attemptOutcome?: "fall" | "take" | "hangdog" | "bailed" | "dab" | "time_up" | "worked_moves";
  attemptsBucket: "1" | "2_3" | "4_6" | "7_10" | "10_plus";
  attemptsCount?: number;
  fallsCount?: number;
  takesCount?: number;
  highPoint?: string;
  fearRating: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  failureReasons: string[];
  betaNotes?: string;
  notes?: string;
  mediaIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  userId: string;
  title: string;
  locationId?: string;
  locationName?: string;
  routeReferenceId?: string;
  gradeLabel: string;
  gradeSystem?: GradeSystem;
  normalizedGradeValue?: number;
  status: "active" | "sent" | "paused" | "abandoned";
  tags: string[];
  betaNotes?: string;
  linkedRouteSource?: "user_created" | "openbeta_route" | "gym_route" | "board_problem" | "outdoor_route";
  linkedRouteId?: string;
  externalUrl?: string;
  firstAttemptDate?: string;
  lastAttemptDate?: string;
  sentDate?: string;
  createdAt: string;
  updatedAt: string;
};

export type Media = {
  id: string;
  userId: string;
  type: "image" | "video";
  uri: string;
  thumbnailUri?: string;
  sessionId?: string;
  climbId?: string;
  projectId?: string;
  caption?: string;
  createdAt: string;
};

export type ShareCard = {
  id: string;
  userId: string;
  type: "session_recap" | "project_send" | "weekly_growth";
  title: string;
  subtitle?: string;
  imageUri?: string;
  data: Record<string, unknown>;
  createdAt: string;
};

export type GymRoute = {
  id: string;
  gymId: string;
  wallId?: string;
  setterId?: string;
  color?: string;
  gradeLabel: string;
  gradeSystem?: string;
  routeName?: string;
  setDate?: string;
  retireDate?: string;
  tags: string[];
  qrCodeId?: string;
  createdAt: string;
  updatedAt: string;
};

export type MetricResult = {
  title: string;
  value: string;
  detail: string;
  empty?: boolean;
};
