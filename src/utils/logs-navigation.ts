import Taro from "@tarojs/taro";
import type { ClimbingSession, GradeSystem } from "@/types/domain";

export type LogsView = "session" | "project";

export type OpenBetaLogPrefill = {
  id: string;
  target: LogsView;
  routeReferenceId: string;
  routeName: string;
  locationName: string;
  gradeLabel?: string;
  gradeSystem?: GradeSystem;
  discipline?: ClimbingSession["discipline"];
  climbTypeLabel?: string;
  betaNotes?: string;
  latitude?: number;
  longitude?: number;
  returnUrl?: string;
};

export const LOGS_PAGE_URL = "/pages/logs/index";
const RECORD_PAGE_URL = "/pages/record/index";
const PROJECTS_PAGE_URL = "/pages/projects/index";

const LOGS_VIEW_STORAGE_KEY = "cgj.logs.view";
const LOGS_SESSION_EDIT_STORAGE_KEY = "cgj.logs.sessionEditId";
const LOGS_OPENBETA_PREFILL_STORAGE_KEY = "cgj.logs.openbetaPrefill";

function isLogsView(value: unknown): value is LogsView {
  return value === "session" || value === "project";
}

export function setNextLogsView(view: LogsView) {
  Taro.setStorageSync(LOGS_VIEW_STORAGE_KEY, view);
}

export function setNextLogsSessionEdit(sessionId: string) {
  Taro.setStorageSync(LOGS_SESSION_EDIT_STORAGE_KEY, sessionId);
}

export function setNextLogsOpenBetaPrefill(prefill: OpenBetaLogPrefill) {
  Taro.setStorageSync(LOGS_OPENBETA_PREFILL_STORAGE_KEY, prefill);
}

export function consumeNextLogsView() {
  const value = Taro.getStorageSync(LOGS_VIEW_STORAGE_KEY);
  Taro.removeStorageSync(LOGS_VIEW_STORAGE_KEY);
  return isLogsView(value) ? value : undefined;
}

export function consumeNextLogsSessionEdit() {
  const value = Taro.getStorageSync(LOGS_SESSION_EDIT_STORAGE_KEY);
  Taro.removeStorageSync(LOGS_SESSION_EDIT_STORAGE_KEY);
  return typeof value === "string" && value ? value : undefined;
}

export function consumeNextLogsOpenBetaPrefill() {
  const value = Taro.getStorageSync(LOGS_OPENBETA_PREFILL_STORAGE_KEY);
  Taro.removeStorageSync(LOGS_OPENBETA_PREFILL_STORAGE_KEY);
  return value && typeof value === "object" && isLogsView((value as OpenBetaLogPrefill).target)
    ? (value as OpenBetaLogPrefill)
    : undefined;
}

export function switchToLogs(view: LogsView, options?: { editSessionId?: string; openBetaPrefill?: OpenBetaLogPrefill }) {
  setNextLogsView(view);
  if (options?.editSessionId) {
    setNextLogsSessionEdit(options.editSessionId);
  }
  if (options?.openBetaPrefill) {
    setNextLogsOpenBetaPrefill(options.openBetaPrefill);
  }
  return Taro.switchTab({ url: LOGS_PAGE_URL });
}

export function navigateToLogEditor(view: LogsView, options?: { openBetaPrefill?: OpenBetaLogPrefill }) {
  setNextLogsView(view);
  if (options?.openBetaPrefill) {
    setNextLogsOpenBetaPrefill(options.openBetaPrefill);
  }

  return Taro.navigateTo({ url: view === "session" ? RECORD_PAGE_URL : PROJECTS_PAGE_URL });
}
