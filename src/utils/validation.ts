import { DraftClimb } from "@/components/climb-sheet";
import { ClimbingSession } from "@/types/domain";

type SessionDraft = Omit<ClimbingSession, "id" | "createdAt" | "updatedAt" | "userId">;

function isPositiveInteger(value?: number) {
  return value === undefined || (Number.isInteger(value) && value > 0);
}

function isNonNegativeInteger(value?: number) {
  return value === undefined || (Number.isInteger(value) && value >= 0);
}

function isRating(value?: number) {
  return value === undefined || (Number.isInteger(value) && value >= 1 && value <= 5);
}

export function validateSessionDraft(sessionDraft: SessionDraft, draftClimbs: DraftClimb[]) {
  if (!sessionDraft.date.trim()) {
    return "请先填写本次 Session 的日期。";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDraft.date.trim())) {
    return "日期请使用 YYYY-MM-DD 格式。";
  }

  if (!sessionDraft.discipline) {
    return "请先选择攀岩类型。";
  }

  if (sessionDraft.discipline === "other" && !sessionDraft.disciplineOtherText?.trim()) {
    return "选择“其他”时，请补充这次 Session 的攀岩类型。";
  }

  if (sessionDraft.durationMinutes !== undefined && !isPositiveInteger(sessionDraft.durationMinutes)) {
    return "时长请填写大于 0 的整数分钟数。";
  }

  if (!isRating(sessionDraft.energyRating) || !isRating(sessionDraft.fatigueRating) || !isRating(sessionDraft.moodRating)) {
    return "精力、疲劳、情绪必须是 1-5 的整数。";
  }

  if (!draftClimbs.length) {
    return "至少先添加 1 条 Climb，再保存 Session。";
  }

  if (draftClimbs.length > 1) {
    return "每条 Session 只能保留 1 条 Climb。请删除多余记录，或把它们拆成不同日期的 Session。";
  }

  return undefined;
}

export function validateDraftClimb(draft: DraftClimb) {
  if (!draft.gradeLabel.trim()) {
    return "请先填写这条 Climb 的难度。";
  }

  if (!draft.outcome) {
    return "请先选择这条 Climb 的完成状态。";
  }

  if (draft.outcome === "sent" && !draft.ascentStyle) {
    return "已完成的 Climb 需要选择完攀方式。";
  }

  if ((draft.outcome === "not_sent" || draft.outcome === "in_progress") && !draft.attemptOutcome) {
    return "已放弃或尝试中的 Climb 需要记录这次发生了什么。";
  }

  if (!isPositiveInteger(draft.attemptsCount)) {
    return "精确尝试次数如果填写，必须是大于 0 的整数。";
  }

  if (!isNonNegativeInteger(draft.fallsCount) || !isNonNegativeInteger(draft.takesCount)) {
    return "坠落次数和 Take 次数如果填写，必须是大于等于 0 的整数。";
  }

  if (!isRating(draft.fearRating)) {
    return "恐惧感必须是 1-5 的整数。";
  }

  if (draft.addToProject && !draft.selectedProjectId && !draft.newProjectTitle?.trim()) {
    return "如果要加入 Project，请选择已有 Project 或填写一个新的标题。";
  }

  return undefined;
}
