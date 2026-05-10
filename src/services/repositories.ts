import { Climb, ClimbingSession, Media, Project, RouteReference, ShareCard } from "@/types/domain";
import { apiRequest } from "./api";

export type CompleteSessionPayload = {
  session: Omit<ClimbingSession, "id" | "createdAt" | "updatedAt" | "userId">;
  climbs: Array<{
    gradeLabel: string;
    gradeSystem?: Climb["gradeSystem"];
    normalizedGradeValue?: number;
    outcome: Climb["outcome"];
    ascentStyle?: Climb["ascentStyle"];
    betaKnowledge?: Climb["betaKnowledge"];
    attemptOutcome?: Climb["attemptOutcome"];
    attemptsBucket: Climb["attemptsBucket"];
    attemptsCount?: number;
    fallsCount?: number;
    takesCount?: number;
    highPoint?: string;
    fearRating: Climb["fearRating"];
    tags: string[];
    failureReasons: string[];
    betaNotes?: string;
    notes?: string;
    routeReferenceId?: string;
    addToProject: boolean;
    selectedProjectId?: string;
    newProjectTitle?: string;
    mediaItems: Array<{
      uri: string;
      type: Media["type"];
      thumbnailUri?: string;
    }>;
  }>;
};

export type CompleteSessionResponse = {
  session: ClimbingSession;
  climbs: Climb[];
  media: Media[];
  projects: Project[];
};

export function createId(prefix: string) {
  const secureId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${prefix}-${secureId}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export async function getBootstrapData() {
  return apiRequest<{
    sessions: ClimbingSession[];
    climbs: Climb[];
    projects: Project[];
    media: Media[];
    shareCards: ShareCard[];
    routeReferences: RouteReference[];
  }>("/bootstrap");
}

export function getSessions() {
  return apiRequest<ClimbingSession[]>("/sessions");
}

export function saveSession(session: ClimbingSession) {
  return apiRequest<ClimbingSession>("/sessions", {
    method: "POST",
    data: session
  });
}

export function saveCompleteSession(payload: CompleteSessionPayload) {
  return apiRequest<CompleteSessionResponse>("/complete-session", {
    method: "POST",
    data: payload
  });
}

export function updateCompleteSession(sessionId: string, payload: CompleteSessionPayload) {
  return apiRequest<CompleteSessionResponse>(`/complete-session/${sessionId}`, {
    method: "PATCH",
    data: payload
  });
}

export function updateSession(session: ClimbingSession) {
  return apiRequest<ClimbingSession>(`/sessions/${session.id}`, {
    method: "PATCH",
    data: session
  });
}

export function getClimbs() {
  return apiRequest<Climb[]>("/climbs");
}

export function saveClimb(climb: Climb) {
  return apiRequest<Climb>("/climbs", {
    method: "POST",
    data: climb
  });
}

export function updateClimb(climb: Climb) {
  return apiRequest<Climb>(`/climbs/${climb.id}`, {
    method: "PATCH",
    data: climb
  });
}

export function getProjects() {
  return apiRequest<Project[]>("/projects");
}

export function saveProject(project: Project) {
  return apiRequest<Project>("/projects", {
    method: "POST",
    data: project
  });
}

export function updateProject(project: Project) {
  return apiRequest<Project>(`/projects/${project.id}`, {
    method: "PATCH",
    data: project
  });
}

export function getMedia() {
  return apiRequest<Media[]>("/media");
}

export function saveMedia(media: Media) {
  return apiRequest<Media>("/media", {
    method: "POST",
    data: media
  });
}

export function getShareCards() {
  return apiRequest<ShareCard[]>("/shareCards");
}

export function saveShareCard(card: ShareCard) {
  return apiRequest<ShareCard>("/shareCards", {
    method: "POST",
    data: card
  });
}

export function updateShareCard(card: ShareCard) {
  return apiRequest<ShareCard>(`/shareCards/${card.id}`, {
    method: "PATCH",
    data: card
  });
}

export function getRouteReferences() {
  return apiRequest<RouteReference[]>("/routeReferences");
}

export function saveRouteReference(route: RouteReference) {
  return apiRequest<RouteReference>("/routeReferences", {
    method: "POST",
    data: route
  });
}

export function updateRouteReference(route: RouteReference) {
  return apiRequest<RouteReference>(`/routeReferences/${route.id}`, {
    method: "PATCH",
    data: route
  });
}
