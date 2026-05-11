import { Button, Input, ScrollView, Switch, Text, Textarea, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useState } from "react";
import {
  ASCENT_STYLE_OPTIONS,
  ATTEMPTS_BUCKET_OPTIONS,
  ATTEMPT_OUTCOME_OPTIONS,
  BETA_KNOWLEDGE_OPTIONS,
  FAILURE_REASON_OPTIONS,
  GRADE_SYSTEM_OPTIONS,
  OTHER_FAILURE_REASON_VALUE,
  OUTCOME_OPTIONS,
  TAG_OPTIONS
} from "@/constants/climbing";
import { GradeSystem, Project } from "@/types/domain";
import { chooseDraftMedia, DraftMediaAsset } from "@/services/media";
import { useI18n } from "@/i18n";
import { buildGradeInfo } from "@/utils/grade";
import { validateDraftClimb } from "@/utils/validation";

export type DraftClimb = {
  id: string;
  gradeLabel: string;
  gradeSystem?: GradeSystem;
  normalizedGradeValue?: number;
  outcome?: "sent" | "not_sent" | "in_progress";
  ascentStyle?: string;
  betaKnowledge?: string;
  attemptOutcome?: string;
  attemptsBucket: "1" | "2_3" | "4_6" | "7_10" | "10_plus";
  attemptsCount?: number;
  fallsCount?: number;
  takesCount?: number;
  highPoint?: string;
  fearRating: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  failureReasons: string[];
  otherFailureReason?: string;
  betaNotes?: string;
  externalBetaNotes?: string;
  externalBetaSource?: "openbeta";
  notes?: string;
  routeReferenceId?: string;
  mediaItems: DraftMediaAsset[];
  addToProject: boolean;
  selectedProjectId?: string;
  newProjectTitle?: string;
};

const RATING_OPTIONS: DraftClimb["fearRating"][] = [1, 2, 3, 4, 5];
const PROJECT_STATUS_LABELS: Record<Project["status"], string> = {
  active: "进行中",
  sent: "已完成",
  paused: "暂停",
  abandoned: "搁置"
};

const defaultDraft: DraftClimb = {
  id: "",
  gradeLabel: "",
  outcome: "not_sent",
  attemptsBucket: "1",
  fearRating: 3,
  tags: [],
  failureReasons: [],
  mediaItems: [],
  addToProject: false
};

function toggleItem(items: string[], target: string) {
  return items.includes(target) ? items.filter((item) => item !== target) : [...items, target];
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const numeric = Number(value);
  return Number.isNaN(numeric) ? undefined : numeric;
}

function hydrateOtherFailureReason(draft: DraftClimb) {
  const otherFailure = draft.failureReasons.find((reason) => reason === OTHER_FAILURE_REASON_VALUE || reason.startsWith(`${OTHER_FAILURE_REASON_VALUE}：`));

  if (!otherFailure) {
    return draft;
  }

  return {
    ...draft,
    failureReasons: Array.from(
      new Set(
        draft.failureReasons.map((reason) => (reason === otherFailure || reason.startsWith(`${OTHER_FAILURE_REASON_VALUE}：`) ? OTHER_FAILURE_REASON_VALUE : reason))
      )
    ),
    otherFailureReason:
      draft.otherFailureReason ??
      (otherFailure.startsWith(`${OTHER_FAILURE_REASON_VALUE}：`) ? otherFailure.slice(`${OTHER_FAILURE_REASON_VALUE}：`.length) : "")
  };
}

function normalizeFailureReasons(draft: DraftClimb) {
  const reasons = draft.failureReasons.filter((reason) => reason !== OTHER_FAILURE_REASON_VALUE && !reason.startsWith(`${OTHER_FAILURE_REASON_VALUE}：`));
  const otherFailureReason = draft.otherFailureReason?.trim();

  if (draft.failureReasons.includes(OTHER_FAILURE_REASON_VALUE) && otherFailureReason) {
    reasons.push(`${OTHER_FAILURE_REASON_VALUE}：${otherFailureReason}`);
  }

  return reasons;
}

export function createEmptyDraft(id: string): DraftClimb {
  return { ...defaultDraft, id };
}

export function ClimbSheet({
  visible,
  projects,
  discipline,
  sessionLocationName,
  initialValue,
  lockedFields,
  onClose,
  onSave,
  submitLabel = "保存到本次 Session"
}: {
  visible: boolean;
  projects: Project[];
  discipline: string;
  sessionLocationName?: string;
  initialValue: DraftClimb;
  lockedFields?: Partial<Record<"gradeLabel" | "gradeSystem" | "routeReferenceId", boolean>>;
  onClose: () => void;
  onSave: (draft: DraftClimb) => void;
  submitLabel?: string;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<DraftClimb>(initialValue);
  const [showMoreFields, setShowMoreFields] = useState(false);

  useEffect(() => {
    setDraft(hydrateOtherFailureReason(initialValue));
  }, [initialValue]);

  if (!visible) {
    return null;
  }

  const comparableGrade = buildGradeInfo(draft.gradeLabel, draft.gradeSystem);
  const selectedProject = draft.selectedProjectId ? projects.find((project) => project.id === draft.selectedProjectId) : undefined;
  const normalizedSessionLocation = sessionLocationName?.trim().toLowerCase() || "";
  const normalizedSelectedProjectLocation = selectedProject?.locationName?.trim().toLowerCase() || "";
  const normalizedSelectedProjectGrade = selectedProject?.gradeLabel?.trim().toLowerCase() || "";
  const normalizedDraftGrade = draft.gradeLabel.trim().toLowerCase();
  const normalizedSelectedProjectRouteReferenceId = selectedProject?.routeReferenceId?.trim().toLowerCase() || "";
  const normalizedDraftRouteReferenceId = draft.routeReferenceId?.trim().toLowerCase() || "";
  const canImportExternalBeta = Boolean(draft.externalBetaSource === "openbeta" && draft.externalBetaNotes?.trim());
  const betaImportLabel =
    draft.externalBetaSource === "openbeta"
      ? canImportExternalBeta
        ? "导入 OpenBeta 笔记"
        : "暂无 OpenBeta 笔记"
      : "不可导入";

  function getSelectedProjectCompatibilityError() {
    if (!selectedProject) {
      return undefined;
    }

    if (
      normalizedSelectedProjectRouteReferenceId &&
      normalizedDraftRouteReferenceId &&
      normalizedSelectedProjectRouteReferenceId !== normalizedDraftRouteReferenceId
    ) {
      return `Project「${selectedProject.title}」已经绑定了另一条线路。`;
    }

    if (normalizedSelectedProjectLocation && normalizedSessionLocation && normalizedSelectedProjectLocation !== normalizedSessionLocation) {
      return `Project 地点是「${selectedProject.locationName}」，和本次 Session 的地点不一致。`;
    }

    if (normalizedSelectedProjectGrade && normalizedDraftGrade && normalizedSelectedProjectGrade !== normalizedDraftGrade) {
      return `Project 记录的是 ${selectedProject.gradeLabel}，当前 Climb 填的是 ${draft.gradeLabel}。`;
    }

    return undefined;
  }

  function getNewProjectDuplicateError() {
    if (!draft.addToProject || !draft.newProjectTitle?.trim()) {
      return undefined;
    }

    const newProjectTitle = draft.newProjectTitle.trim().toLowerCase();
    const draftLocationName = normalizedSessionLocation;

    const duplicate = projects.find((project) => {
      const projectRouteReferenceId = project.routeReferenceId?.trim().toLowerCase() || "";

      if (normalizedDraftRouteReferenceId && projectRouteReferenceId && projectRouteReferenceId === normalizedDraftRouteReferenceId) {
        return true;
      }

      return (
        newProjectTitle &&
        normalizedDraftGrade &&
        project.title.trim().toLowerCase() === newProjectTitle &&
        (project.locationName?.trim().toLowerCase() || "") === draftLocationName &&
        (project.gradeLabel?.trim().toLowerCase() || "") === normalizedDraftGrade
      );
    });

    if (!duplicate) {
      return undefined;
    }

    return normalizedDraftRouteReferenceId && duplicate.routeReferenceId?.trim().toLowerCase() === normalizedDraftRouteReferenceId
      ? `这条路线已经有 Project「${duplicate.title}」。`
      : `已经有同名、同地点、同难度的 Project「${duplicate.title}」。`;
  }

  const selectedProjectCompatibilityError = getSelectedProjectCompatibilityError();
  const newProjectDuplicateError = getNewProjectDuplicateError();

  function handleSubmit() {
    const nextDraft: DraftClimb = {
      ...draft,
      gradeLabel: draft.gradeLabel.trim(),
      routeReferenceId: draft.routeReferenceId?.trim() || undefined,
      newProjectTitle: draft.newProjectTitle?.trim() || undefined,
      attemptOutcome: draft.outcome === "sent" ? undefined : draft.attemptOutcome,
      highPoint: draft.outcome === "sent" ? undefined : draft.highPoint?.trim() || undefined,
      otherFailureReason: draft.outcome === "sent" ? undefined : draft.otherFailureReason?.trim(),
      failureReasons: draft.outcome === "sent" ? [] : draft.failureReasons,
      takesCount: discipline === "bouldering" ? undefined : draft.takesCount,
      normalizedGradeValue: comparableGrade.normalizedGradeValue,
      gradeSystem: draft.gradeSystem ?? comparableGrade.gradeSystem
    };

    const error = validateDraftClimb(nextDraft);

    if (error) {
      Taro.showToast({ title: error, icon: "none" });
      return;
    }

    if (selectedProjectCompatibilityError) {
      Taro.showToast({ title: selectedProjectCompatibilityError, icon: "none" });
      return;
    }

    if (newProjectDuplicateError) {
      Taro.showToast({ title: newProjectDuplicateError, icon: "none" });
      return;
    }

    onSave({
      ...nextDraft,
      failureReasons: normalizeFailureReasons(nextDraft),
      otherFailureReason: undefined
    });
  }

  async function handlePickMedia() {
    try {
      const picked = await chooseDraftMedia(draft.mediaItems.length);
      setDraft({ ...draft, mediaItems: [...draft.mediaItems, ...picked] });
    } catch (error) {
      if (error && typeof error === "object" && "errMsg" in error && String(error.errMsg).includes("cancel")) {
        return;
      }

      Taro.showToast({ title: t("媒体选择失败"), icon: "none" });
    }
  }

  function renderProjectFields() {
    return (
      <View className="card">
        <Text className="field-label">{t("加入 Project")}</Text>
        <View className="row-between">
          <View className="card-subtitle">{t("如果这条线值得持续尝试或归档，就把它关联到 Project。")}</View>
          <Switch checked={draft.addToProject} onChange={(event) => setDraft({ ...draft, addToProject: event.detail.value })} />
        </View>
        {draft.addToProject ? (
          <View className="stack-sm" style={{ marginTop: "12px" }}>
            <View>
              <Text className="field-label">{t("选择已有 Project")}</Text>
              <View className="choice-group">
                {projects.map((project) => (
                  <View
                    key={project.id}
                    className={`choice-chip ${draft.selectedProjectId === project.id ? "active" : ""}`}
                    onClick={() => setDraft({ ...draft, selectedProjectId: project.id, newProjectTitle: "" })}
                  >
                    {project.title} · {t(PROJECT_STATUS_LABELS[project.status])}
                  </View>
                ))}
              </View>
              {selectedProjectCompatibilityError ? <View className="card-subtitle">{selectedProjectCompatibilityError}</View> : null}
            </View>
            <View>
              <Text className="field-label">{t("或直接新建 Project")}</Text>
              <Input
                className="input"
                value={draft.newProjectTitle ?? ""}
                placeholder={t("例如 黄线屋檐 Project")}
                onInput={(event) => setDraft({ ...draft, newProjectTitle: event.detail.value, selectedProjectId: undefined })}
              />
              {newProjectDuplicateError ? <View className="card-subtitle">{newProjectDuplicateError}</View> : null}
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View className="sheet-backdrop" onClick={onClose}>
      <View className="sheet" onClick={(event) => event.stopPropagation()}>
        <View className="page-title">{t("添加 Climb")}</View>
        <View className="page-subtitle">{t("先回答结果，再补充恐惧、尝试和卡点。")}</View>

        <ScrollView scrollY style={{ maxHeight: "72vh" }}>
          <View className="stack-md">
            <View>
              <Text className="field-label">{t("难度")}</Text>
              <Input
                className={`input ${lockedFields?.gradeLabel ? "locked-field" : ""}`}
                value={draft.gradeLabel}
                placeholder="例如 V4 / 6B / 5.11a / 蓝线"
                disabled={Boolean(lockedFields?.gradeLabel)}
                onInput={(event) => setDraft({ ...draft, gradeLabel: event.detail.value })}
              />
              {lockedFields?.gradeLabel ? <View className="inline-note">{t("来自 OpenBeta，保存时不可更改。")}</View> : null}
            </View>

            <View>
              <Text className="field-label">{t("难度体系")}</Text>
              <View className="choice-group">
                {GRADE_SYSTEM_OPTIONS.map((option) => (
                  <View
                    key={option.value}
                    className={`choice-chip ${draft.gradeSystem === option.value ? "active" : ""} ${lockedFields?.gradeSystem ? "locked-chip" : ""}`}
                    onClick={() => {
                      if (!lockedFields?.gradeSystem) {
                        setDraft({ ...draft, gradeSystem: option.value });
                      }
                    }}
                  >
                    {t(option.label)}
                  </View>
                ))}
              </View>
              <View className="page-subtitle">
                {t("标准化等级：")}{comparableGrade.normalizedGradeValue ?? t("暂不可比较")}
                {!draft.gradeSystem && comparableGrade.gradeSystem ? ` · 已识别为 ${comparableGrade.gradeSystem}` : ""}
              </View>
            </View>

            <View>
              <Text className="field-label">{t("你完成这条线了吗？")}</Text>
              <View className="choice-group">
                {OUTCOME_OPTIONS.map((option) => (
                  <View
                    key={option.value}
                    className={`choice-chip ${draft.outcome === option.value ? "active" : ""}`}
                    onClick={() => setDraft({ ...draft, outcome: option.value })}
                  >
                    {t(option.label)}
                  </View>
                ))}
              </View>
            </View>

            {draft.outcome === "sent" ? (
              <View>
                <Text className="field-label">{t("你是怎么完成的？")}</Text>
                <View className="choice-group">
                  {ASCENT_STYLE_OPTIONS.map((option) => (
                    <View
                      key={option.value}
                      className={`choice-chip ${draft.ascentStyle === option.value ? "active" : ""}`}
                      onClick={() => setDraft({ ...draft, ascentStyle: option.value })}
                    >
                      {t(option.label)}
                    </View>
                  ))}
                </View>
              </View>
            ) : draft.outcome ? (
              <>
                <View>
                  <Text className="field-label">{t("这次尝试发生了什么？")}</Text>
                  <View className="choice-group">
                    {ATTEMPT_OUTCOME_OPTIONS.map((option) => (
                      <View
                        key={option.value}
                        className={`choice-chip ${draft.attemptOutcome === option.value ? "active" : ""}`}
                        onClick={() => setDraft({ ...draft, attemptOutcome: option.value })}
                      >
                        {t(option.label)}
                      </View>
                    ))}
                  </View>
                </View>
              </>
            ) : null}

            {renderProjectFields()}

            <View>
              <Text className="field-label">{t("是否知道 beta")}</Text>
              <View className="choice-group">
                {BETA_KNOWLEDGE_OPTIONS.map((option) => (
                  <View
                    key={option.value}
                    className={`choice-chip ${draft.betaKnowledge === option.value ? "active" : ""}`}
                    onClick={() => setDraft({ ...draft, betaKnowledge: option.value })}
                  >
                    {t(option.label)}
                  </View>
                ))}
              </View>
            </View>

            <View className="row-between">
              <View style={{ flex: 1 }}>
                <Text className="field-label">{t("尝试次数区间")}</Text>
                <View className="choice-group">
                  {ATTEMPTS_BUCKET_OPTIONS.map((option) => (
                    <View
                      key={option.value}
                      className={`choice-chip ${draft.attemptsBucket === option.value ? "active" : ""}`}
                      onClick={() => setDraft({ ...draft, attemptsBucket: option.value })}
                    >
                      {option.label}
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View className="row">
              <View style={{ flex: 1 }}>
                <Text className="field-label">{t("精确尝试次数")}</Text>
                <Input
                  className="input"
                  type="number"
                  value={draft.attemptsCount ? String(draft.attemptsCount) : ""}
                  onInput={(event) => setDraft({ ...draft, attemptsCount: parseOptionalNumber(event.detail.value) })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text className="field-label">{t("恐惧感 1-5")}</Text>
                <View className="choice-group">
                  {RATING_OPTIONS.map((option) => (
                    <View
                      key={option}
                      className={`choice-chip ${draft.fearRating === option ? "active" : ""}`}
                      onClick={() => setDraft({ ...draft, fearRating: option })}
                    >
                      {option}
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View className="row">
              <View style={{ flex: 1 }}>
                <Text className="field-label">{t("坠落次数")}</Text>
                <Input
                  className="input"
                  type="number"
                  value={draft.fallsCount !== undefined ? String(draft.fallsCount) : ""}
                  onInput={(event) => setDraft({ ...draft, fallsCount: parseOptionalNumber(event.detail.value) })}
                />
              </View>
              {discipline !== "bouldering" ? (
                <View style={{ flex: 1 }}>
                  <Text className="field-label">{t("Take 次数")}</Text>
                  <Input
                    className="input"
                    type="number"
                    value={draft.takesCount !== undefined ? String(draft.takesCount) : ""}
                    onInput={(event) => setDraft({ ...draft, takesCount: parseOptionalNumber(event.detail.value) })}
                  />
                </View>
              ) : null}
            </View>

            <Button className="ghost-button" onClick={() => setShowMoreFields(!showMoreFields)}>
              {showMoreFields ? t("收起更多信息") : t("展开更多信息")}
            </Button>

            {showMoreFields ? (
              <>
                {draft.outcome && draft.outcome !== "sent" ? (
                  <View>
                    <Text className="field-label">High point</Text>
                    <Input
                      className="input"
                      value={draft.highPoint ?? ""}
                      placeholder="第几手 / 第几个 clip / 约百分比"
                      onInput={(event) => setDraft({ ...draft, highPoint: event.detail.value })}
                    />
                  </View>
                ) : null}

            <View>
              <Text className="field-label">{t("动作标签")}</Text>
              <View className="choice-group">
                {TAG_OPTIONS.map((tag) => (
                  <View
                    key={tag}
                    className={`choice-chip ${draft.tags.includes(tag) ? "active" : ""}`}
                    onClick={() => setDraft({ ...draft, tags: toggleItem(draft.tags, tag) })}
                  >
                    {tag}
                  </View>
                ))}
              </View>
            </View>

            {draft.outcome && draft.outcome !== "sent" ? (
              <View>
                <Text className="field-label">{t("失败原因")}</Text>
                <View className="choice-group">
                  {FAILURE_REASON_OPTIONS.map((reason) => (
                    <View
                      key={reason}
                      className={`choice-chip ${draft.failureReasons.includes(reason) ? "active" : ""}`}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          failureReasons: toggleItem(draft.failureReasons, reason),
                          otherFailureReason: reason === OTHER_FAILURE_REASON_VALUE && draft.failureReasons.includes(reason) ? undefined : draft.otherFailureReason
                        })
                      }
                    >
                      {t(reason)}
                    </View>
                  ))}
                </View>
                {draft.failureReasons.includes(OTHER_FAILURE_REASON_VALUE) ? (
                  <Input
                    className="input"
                    value={draft.otherFailureReason ?? ""}
                    placeholder={t("写下具体原因")}
                    onInput={(event) => setDraft({ ...draft, otherFailureReason: event.detail.value })}
                  />
                ) : null}
              </View>
            ) : null}

            <View>
              <Text className="field-label">{t("Beta 笔记")}</Text>
              <View className={`external-beta-import ${canImportExternalBeta ? "" : "disabled"}`}>
                <View className="card-subtitle">OpenBeta Notes</View>
                <Button
                  className={`secondary-button beta-import-button ${canImportExternalBeta ? "" : "disabled"}`}
                  disabled={!canImportExternalBeta}
                  onClick={() => {
                    if (canImportExternalBeta) {
                      setDraft({ ...draft, betaNotes: draft.externalBetaNotes, betaKnowledge: draft.betaKnowledge ?? "read_beta" });
                    }
                  }}
                >
                  {t(betaImportLabel)}
                </Button>
              </View>
              <Textarea
                className="textarea"
                value={draft.betaNotes ?? ""}
                onInput={(event) => setDraft({ ...draft, betaNotes: event.detail.value })}
              />
            </View>

            <View>
              <Text className="field-label">{t("备注")}</Text>
              <Textarea
                className="textarea"
                value={draft.notes ?? ""}
                onInput={(event) => setDraft({ ...draft, notes: event.detail.value })}
              />
            </View>

            <View>
              <Text className="field-label">{t("RouteReference ID（预留）")}</Text>
              <Input
                className={`input ${lockedFields?.routeReferenceId ? "locked-field" : ""}`}
                value={draft.routeReferenceId ?? ""}
                placeholder={t("P0 不做外部搜索，仅保留可写字段")}
                disabled={Boolean(lockedFields?.routeReferenceId)}
                onInput={(event) => setDraft({ ...draft, routeReferenceId: event.detail.value })}
              />
              {lockedFields?.routeReferenceId ? <View className="inline-note">{t("已绑定 OpenBeta UUID，不能改成其他线路。")}</View> : null}
            </View>

            <View>
              <Text className="field-label">{t("媒体占位")}</Text>
              <View className="card-subtitle">{t("图片和视频会在保存整个 Session 后写入你的攀岩相册列表。")}</View>
              <View className="row" style={{ marginTop: "12px" }}>
                <Button className="secondary-button" onClick={handlePickMedia}>
                  {t("选择图片 / 视频")}
                </Button>
                <View className="pill">{draft.mediaItems.length} {t("个")}</View>
              </View>
              {draft.mediaItems.length ? (
                <View className="stack-sm" style={{ marginTop: "12px" }}>
                  {draft.mediaItems.map((item, index) => (
                    <View key={`${item.uri}-${index}`} className="list-item">
                      <View className="row-between">
                        <View>
                          <View>{item.type === "image" ? t("图片") : t("视频")}</View>
                          <View className="card-subtitle">{item.uri}</View>
                        </View>
                        <Button
                          className="ghost-button"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              mediaItems: draft.mediaItems.filter((_, itemIndex) => itemIndex !== index)
                            })
                          }
                        >
                          {t("删除")}
                        </Button>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
              </>
            ) : null}
          </View>
        </ScrollView>

        <View className="row" style={{ marginTop: "20px" }}>
          <Button className="ghost-button" onClick={onClose}>
            {t("取消")}
          </Button>
          <Button
            className="primary-button"
            onClick={handleSubmit}
          >
            {t(submitLabel)}
          </Button>
        </View>
      </View>
    </View>
  );
}
