import { Button, Input, Text, Textarea, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useState } from "react";
import { ClimbSheet, createEmptyDraft, DraftClimb } from "@/components/climb-sheet";
import { Card, EmptyState, PageHeader, PillRow, SectionTitle } from "@/components/common";
import { ShareCardModal } from "@/components/share-card-modal";
import { DISCIPLINE_OPTIONS, FAILURE_REASON_OPTIONS, OTHER_FAILURE_REASON_VALUE, OUTCOME_LABELS } from "@/constants/climbing";
import { useBootstrapData } from "@/hooks/use-bootstrap-data";
import { useI18n } from "@/i18n";
import { useProtectedPage } from "@/hooks/use-protected-page";
import { DraftMediaAsset, persistMediaUri } from "@/services/media";
import { CompleteSessionPayload, createId, deleteSession, saveCompleteSession, updateCompleteSession } from "@/services/repositories";
import { readStorage, removeStorage, writeStorage } from "@/services/storage";
import { Climb, ClimbingSession, Media, Project, ShareCard } from "@/types/domain";
import { buildGradeInfo } from "@/utils/grade";
import type { OpenBetaLogPrefill } from "@/utils/logs-navigation";
import { compareSessionsByRecentActivity, formatSessionActivityTime } from "@/utils/session-order";
import { buildDailySessionRecapCard } from "@/utils/share-cards";
import { validateSessionDraft } from "@/utils/validation";

type RatingValue = 1 | 2 | 3 | 4 | 5;
type SessionDraft = Omit<ClimbingSession, "id" | "createdAt" | "updatedAt" | "userId">;

const RATING_OPTIONS: RatingValue[] = [1, 2, 3, 4, 5];
const SESSION_DRAFT_STORAGE_KEY = "cgj.session-draft.v1";

type StoredSessionDraft = {
  sessionDraft: SessionDraft;
  draftClimbs: DraftClimb[];
  openBetaPrefill?: OpenBetaLogPrefill;
};

function formatLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDateSearchTokens(dateValue?: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue ?? "");

  if (!match) {
    return [dateValue].filter(Boolean);
  }

  const [, year, monthText, dayText] = match;
  const shortYear = year.slice(2);
  const month = String(Number(monthText));
  const day = String(Number(dayText));

  return [
    `${year}-${monthText}-${dayText}`,
    `${year}${monthText}${dayText}`,
    `${year}年${month}月${day}日`,
    `${shortYear}年${month}月${day}日`,
    `${year}年`,
    `${shortYear}年`,
    `${month}月`,
    `${monthText}月`,
    `${day}日`,
    `${day}号`,
    `${dayText}日`,
    `${dayText}号`
  ];
}

function RatingSelector({
  label,
  value,
  onChange
}: {
  label: string;
  value: RatingValue;
  onChange: (value: RatingValue) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text className="field-label">{label}</Text>
      <View className="choice-group">
        {RATING_OPTIONS.map((option) => (
          <View key={option} className={`choice-chip ${value === option ? "active" : ""}`} onClick={() => onChange(option)}>
            {option}
          </View>
        ))}
      </View>
    </View>
  );
}

function createEmptySessionDraft(): SessionDraft {
  return {
    date: formatLocalDate(),
    locationName: "",
    discipline: "bouldering",
    disciplineOtherText: undefined,
    durationMinutes: undefined,
    energyRating: 3,
    fatigueRating: 3,
    moodRating: 3,
    summary: ""
  };
}

function buildSessionDraftFromSession(session: ClimbingSession): SessionDraft {
  return {
    date: session.date,
    locationName: session.locationName ?? "",
    discipline: session.discipline,
    disciplineOtherText: session.disciplineOtherText,
    durationMinutes: session.durationMinutes,
    energyRating: session.energyRating ?? 3,
    fatigueRating: session.fatigueRating ?? 3,
    moodRating: session.moodRating ?? 3,
    summary: session.summary ?? ""
  };
}

function buildDraftFromSavedClimb(climb: Climb, projects: Project[], mediaItems: DraftMediaAsset[]): DraftClimb {
  const knownFailureReasons = new Set<string>(FAILURE_REASON_OPTIONS);
  const customFailureReason = climb.failureReasons.find((reason) => !knownFailureReasons.has(reason));

  return {
    id: climb.id,
    gradeLabel: climb.gradeLabel,
    gradeSystem: climb.gradeSystem,
    normalizedGradeValue: climb.normalizedGradeValue,
    outcome: climb.outcome,
    ascentStyle: climb.ascentStyle,
    betaKnowledge: climb.betaKnowledge,
    attemptOutcome: climb.attemptOutcome,
    attemptsBucket: climb.attemptsBucket,
    attemptsCount: climb.attemptsCount,
    fallsCount: climb.fallsCount,
    takesCount: climb.takesCount,
    highPoint: climb.highPoint,
    fearRating: climb.fearRating,
    tags: climb.tags,
    failureReasons: Array.from(new Set(climb.failureReasons.map((reason) => (knownFailureReasons.has(reason) ? reason : OTHER_FAILURE_REASON_VALUE)))),
    otherFailureReason: customFailureReason?.startsWith(`${OTHER_FAILURE_REASON_VALUE}：`)
      ? customFailureReason.slice(`${OTHER_FAILURE_REASON_VALUE}：`.length)
      : customFailureReason,
    betaNotes: climb.betaNotes,
    externalBetaNotes: undefined,
    externalBetaSource: undefined,
    notes: climb.notes,
    routeReferenceId: climb.routeReferenceId,
    mediaItems,
    addToProject: Boolean(climb.projectId),
    selectedProjectId: climb.projectId && projects.some((project) => project.id === climb.projectId) ? climb.projectId : undefined,
    newProjectTitle: undefined
  };
}

function buildDraftFromOpenBetaPrefill(prefill: OpenBetaLogPrefill): DraftClimb {
  const gradeInfo = prefill.gradeLabel ? buildGradeInfo(prefill.gradeLabel, prefill.gradeSystem) : undefined;

  return {
    ...createEmptyDraft(createId("draft-climb")),
    gradeLabel: prefill.gradeLabel ?? "",
    gradeSystem: gradeInfo?.gradeSystem ?? prefill.gradeSystem,
    normalizedGradeValue: gradeInfo?.normalizedGradeValue,
    outcome: undefined,
    betaKnowledge: undefined,
    betaNotes: undefined,
    externalBetaNotes: prefill.betaNotes,
    externalBetaSource: "openbeta",
    notes: `OpenBeta: ${prefill.routeName}`,
    routeReferenceId: prefill.routeReferenceId
  };
}

function readStoredSessionDraft() {
  return readStorage<StoredSessionDraft | undefined>(SESSION_DRAFT_STORAGE_KEY, undefined);
}

function hasSessionDraftContent(sessionDraft: SessionDraft, draftClimbs: DraftClimb[]) {
  const empty = createEmptySessionDraft();

  return (
    draftClimbs.length > 0 ||
    sessionDraft.locationName?.trim() ||
    sessionDraft.durationMinutes ||
    sessionDraft.summary?.trim() ||
    sessionDraft.discipline !== empty.discipline ||
    sessionDraft.disciplineOtherText?.trim()
  );
}

export function SessionLogsContent({
  showHeader = true,
  focusSessionId,
  openBetaPrefill,
  onFocusSessionHandled
}: {
  showHeader?: boolean;
  focusSessionId?: string;
  openBetaPrefill?: OpenBetaLogPrefill;
  onFocusSessionHandled?: () => void;
}) {
  const auth = useProtectedPage();
  const { language, t } = useI18n();
  const { projects, sessions, climbs, media, reload } = useBootstrapData(auth.isAuthenticated && !auth.isLoading);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [draftClimbs, setDraftClimbs] = useState<DraftClimb[]>([]);
  const [editingDraftId, setEditingDraftId] = useState<string | undefined>();
  const [editingSessionId, setEditingSessionId] = useState<string | undefined>();
  const [shareCard, setShareCard] = useState<ShareCard | undefined>();
  const [editorDraft, setEditorDraft] = useState<DraftClimb>(createEmptyDraft(createId("draft-climb")));
  const [isSaving, setIsSaving] = useState(false);
  const [sessionSearchQuery, setSessionSearchQuery] = useState("");
  const [sessionDraft, setSessionDraft] = useState<SessionDraft>(createEmptySessionDraft);
  const [hasStoredSessionDraft, setHasStoredSessionDraft] = useState(Boolean(readStoredSessionDraft()));
  const [activeOpenBetaSessionPrefill, setActiveOpenBetaSessionPrefill] = useState<OpenBetaLogPrefill | undefined>();
  const sortedSessions = [...sessions].sort(compareSessionsByRecentActivity);
  const normalizedSessionSearch = sessionSearchQuery.trim().toLowerCase();
  const filteredSessions = normalizedSessionSearch
    ? sortedSessions.filter((session) => {
        const sessionClimbs = climbs.filter((climb) => climb.sessionId === session.id);
        const searchableText = [
          session.date,
          ...buildDateSearchTokens(session.date),
          session.locationName,
          session.discipline,
          session.disciplineOtherText,
          session.summary,
          ...sessionClimbs.flatMap((climb) => [
            climb.gradeLabel,
            OUTCOME_LABELS[climb.outcome],
            climb.ascentStyle,
            climb.attemptOutcome,
            climb.highPoint,
            climb.betaNotes,
            climb.notes,
            ...climb.tags,
            ...climb.failureReasons
          ])
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedSessionSearch);
      })
    : sortedSessions;
  const projectOptions = [...projects].sort((left, right) =>
    String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || ""))
  );

  function resetEditorState() {
    setDraftClimbs([]);
    setEditingDraftId(undefined);
    setEditingSessionId(undefined);
    setEditorDraft(createEmptyDraft(createId("draft-climb")));
    setSessionDraft(createEmptySessionDraft());
    setActiveOpenBetaSessionPrefill(undefined);
    setSheetVisible(false);
    removeStorage(SESSION_DRAFT_STORAGE_KEY);
    setHasStoredSessionDraft(false);
  }

  function restoreStoredSessionDraft() {
    const stored = readStoredSessionDraft();

    if (!stored) {
      setHasStoredSessionDraft(false);
      return;
    }

    setEditingSessionId(undefined);
    setActiveOpenBetaSessionPrefill(stored.openBetaPrefill);
    setEditingDraftId(undefined);
    setSessionDraft(stored.sessionDraft);
    setDraftClimbs(stored.draftClimbs);
    setEditorDraft(stored.draftClimbs[0] ?? createEmptyDraft(createId("draft-climb")));
    setHasStoredSessionDraft(false);
  }

  function discardStoredSessionDraft() {
    removeStorage(SESSION_DRAFT_STORAGE_KEY);
    setHasStoredSessionDraft(false);
  }

  async function handleDeleteSession(sessionId: string) {
    const targetSession = sessions.find((session) => session.id === sessionId);
    const confirmed = await Taro.showModal({
      title: t("删除 Session"),
      content:
        language === "en"
          ? `Delete the ${targetSession?.date ?? "selected"} Session? Its Climb and media links will also be removed.`
          : `确定删除 ${targetSession?.date ?? "这条"} Session 吗？里面的 Climb 和媒体关联也会一起删除。`,
      confirmText: t("删除"),
      confirmColor: "#B3261E",
      cancelText: t("取消")
    });

    if (!confirmed.confirm) {
      return;
    }

    try {
      await deleteSession(sessionId);
      if (editingSessionId === sessionId) {
        resetEditorState();
      }
      await reload();
      Taro.showToast({ title: t("Session 已删除"), icon: "success" });
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : t("删除失败"), icon: "none" });
    }
  }

  function openSheet() {
    if (draftClimbs.length === 1) {
      openSheetForEdit(draftClimbs[0].id);
      return;
    }

    if (draftClimbs.length > 1) {
      Taro.showToast({ title: "每条 Session 只保留 1 条 Climb，请先删除多余记录。", icon: "none" });
      return;
    }

    setEditingDraftId(undefined);
    setEditorDraft(createEmptyDraft(createId("draft-climb")));
    setSheetVisible(true);
  }

  function openSheetForEdit(draftId: string) {
    const existing = draftClimbs.find((item) => item.id === draftId);

    if (!existing) {
      return;
    }

    setEditingDraftId(draftId);
    setEditorDraft(existing);
    setSheetVisible(true);
  }

  function removeDraftClimb(draftId: string) {
    const deletedDraft = draftClimbs.find((item) => item.id === draftId);
    setDraftClimbs(draftClimbs.filter((item) => item.id !== draftId));

    if (deletedDraft?.routeReferenceId && deletedDraft.routeReferenceId === activeOpenBetaSessionPrefill?.routeReferenceId) {
      setActiveOpenBetaSessionPrefill(undefined);
    }
  }

  function handleEditSession(sessionId: string) {
    const session = sessions.find((item) => item.id === sessionId);

    if (!session) {
      return;
    }

    const sessionClimbs = climbs.filter((climb) => climb.sessionId === sessionId).sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    setEditingSessionId(sessionId);
    setActiveOpenBetaSessionPrefill(undefined);
    setEditingDraftId(undefined);
    setEditorDraft(createEmptyDraft(createId("draft-climb")));
    setDraftClimbs(
      sessionClimbs.map((climb) => {
        const climbMedia = (climb.mediaIds.length
          ? climb.mediaIds.map((mediaId) => media.find((item) => item.id === mediaId)).filter(Boolean)
          : media.filter((item) => item.climbId === climb.id)) as Media[];

        return buildDraftFromSavedClimb(
          climb,
          projectOptions,
          climbMedia.map((item) => ({
            uri: item.uri,
            type: item.type,
            thumbnailUri: item.thumbnailUri
          }))
        );
      })
    );
    setSessionDraft(buildSessionDraftFromSession(session));
    void Taro.pageScrollTo({ scrollTop: 0, duration: 0 }).catch(() => undefined);
  }

  useEffect(() => {
    if (!openBetaPrefill || openBetaPrefill.target !== "session") {
      return;
    }

    const prefilledDraft = buildDraftFromOpenBetaPrefill(openBetaPrefill);
    const nextSessionDraft = {
      ...createEmptySessionDraft(),
      locationName: openBetaPrefill.locationName,
      discipline: openBetaPrefill.discipline ?? "outdoor"
    };

    setEditingSessionId(undefined);
    setEditingDraftId(undefined);
    setActiveOpenBetaSessionPrefill(openBetaPrefill);
    setSessionDraft(nextSessionDraft);
    setDraftClimbs([prefilledDraft]);
    setEditorDraft(prefilledDraft);
    setSheetVisible(false);
    void Taro.pageScrollTo({ scrollTop: 0, duration: 0 }).catch(() => undefined);
  }, [openBetaPrefill?.id]);

  useEffect(() => {
    if (!focusSessionId) {
      return;
    }

    if (!sessions.some((session) => session.id === focusSessionId)) {
      return;
    }

    handleEditSession(focusSessionId);
    onFocusSessionHandled?.();
  }, [focusSessionId, sessions, climbs, media, projects]);

  useEffect(() => {
    if (editingSessionId) {
      return;
    }

    if (!hasSessionDraftContent(sessionDraft, draftClimbs)) {
      return;
    }

    writeStorage<StoredSessionDraft>(SESSION_DRAFT_STORAGE_KEY, {
      sessionDraft,
      draftClimbs,
      openBetaPrefill: activeOpenBetaSessionPrefill
    });
  }, [sessionDraft, draftClimbs, editingSessionId, activeOpenBetaSessionPrefill]);

  async function handleSaveSession() {
    if (!auth.user) {
      return;
    }

    const sessionError = validateSessionDraft(sessionDraft, draftClimbs);

    if (sessionError) {
      Taro.showToast({ title: sessionError, icon: "none" });
      return;
    }

    setIsSaving(true);

    try {
      const climbsPayload: CompleteSessionPayload["climbs"] = [];

      for (const draft of draftClimbs) {
        const mediaItems = [];

        for (const item of draft.mediaItems) {
          const persistedUri = await persistMediaUri(item.uri);
          const persistedThumbnailUri = item.thumbnailUri ? await persistMediaUri(item.thumbnailUri) : persistedUri;

          mediaItems.push({
            type: item.type,
            uri: persistedUri,
            thumbnailUri: persistedThumbnailUri
          });
        }

        climbsPayload.push({
          gradeLabel: draft.gradeLabel,
          gradeSystem: draft.gradeSystem as Climb["gradeSystem"],
          normalizedGradeValue: draft.normalizedGradeValue,
          outcome: draft.outcome as Climb["outcome"],
          ascentStyle: draft.ascentStyle as Climb["ascentStyle"],
          betaKnowledge: draft.betaKnowledge as Climb["betaKnowledge"],
          attemptOutcome: draft.attemptOutcome as Climb["attemptOutcome"],
          attemptsBucket: draft.attemptsBucket,
          attemptsCount: draft.attemptsCount,
          fallsCount: draft.fallsCount,
          takesCount: draft.takesCount,
          highPoint: draft.highPoint,
          fearRating: draft.fearRating,
          tags: draft.tags,
          failureReasons: draft.failureReasons,
          betaNotes: draft.betaNotes,
          notes: draft.notes,
          routeReferenceId: draft.routeReferenceId,
          addToProject: draft.addToProject,
          selectedProjectId: draft.selectedProjectId,
          newProjectTitle: draft.newProjectTitle,
          mediaItems
        });
      }

      const payload: CompleteSessionPayload = {
        session: {
          date: sessionDraft.date,
          locationName: sessionDraft.locationName || undefined,
          discipline: sessionDraft.discipline,
          disciplineOtherText: sessionDraft.discipline === "other" ? sessionDraft.disciplineOtherText?.trim() || undefined : undefined,
          durationMinutes: sessionDraft.durationMinutes,
          energyRating: sessionDraft.energyRating,
          fatigueRating: sessionDraft.fatigueRating,
          moodRating: sessionDraft.moodRating,
          summary: sessionDraft.summary || undefined
        },
        climbs: climbsPayload
      };

      if (editingSessionId) {
        await updateCompleteSession(editingSessionId, payload);
      } else {
        await saveCompleteSession(payload);
      }

      await reload();

      Taro.showToast({ title: editingSessionId ? "Session 已更新" : "Session 已保存", icon: "success" });
      resetEditorState();
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" });
    } finally {
      setIsSaving(false);
    }
  }

  function handleGenerateTodayShareCard() {
    if (!auth.user) {
      return;
    }

    const today = formatLocalDate();
    const todaySessions = sessions.filter((session) => session.date === today);

    if (!todaySessions.length) {
      Taro.showToast({ title: "今天还没有保存 Session", icon: "none" });
      return;
    }

    const todaySessionIds = new Set(todaySessions.map((session) => session.id));
    const todayClimbs = climbs.filter((climb) => todaySessionIds.has(climb.sessionId));

    if (!todayClimbs.length) {
      Taro.showToast({ title: "今天还没有可生成的 Climb 记录", icon: "none" });
      return;
    }

    setShareCard(buildDailySessionRecapCard(auth.user.id, today, todaySessions, todayClimbs));
  }

  const body = (
    <>
      {activeOpenBetaSessionPrefill ? (
        <Card>
          <View className="row-between">
            <View>
              <View className="eyebrow-row">
                <View className="status-dot blue" />
                <View className="eyebrow-text">OPENBETA PREFILL</View>
              </View>
              <View className="card-title">{activeOpenBetaSessionPrefill.routeName}</View>
              <View className="card-subtitle">线路、地点、难度和 OpenBeta ID 已锁定。你只需要补这次尝试的结果、次数和感受。</View>
            </View>
            <Button className="ghost-button" onClick={resetEditorState}>
              取消导入
            </Button>
          </View>
        </Card>
      ) : null}

      {hasStoredSessionDraft && !activeOpenBetaSessionPrefill && !editingSessionId ? (
        <Card>
          <View className="row-between">
            <View>
              <View className="card-title">{t("发现未保存草稿")}</View>
              <View className="card-subtitle">{t("可以恢复上次未保存的 Session 草稿。")}</View>
            </View>
            <View className="row">
              <Button className="ghost-button" onClick={discardStoredSessionDraft}>
                {t("丢弃")}
              </Button>
              <Button className="secondary-button" onClick={restoreStoredSessionDraft}>
                {t("恢复")}
              </Button>
            </View>
          </View>
        </Card>
      ) : null}

      {editingSessionId ? (
        <Card>
          <View className="row-between">
            <View>
              <View className="card-title">{t("正在编辑已保存 Session")}</View>
              <View className="card-subtitle">{t("这次保存会直接覆盖原来的 Session、Climbs 和媒体关联。")}</View>
            </View>
            <Button className="ghost-button" onClick={resetEditorState}>
              {t("取消编辑")}
            </Button>
          </View>
        </Card>
      ) : null}

      <Card>
        <View className="stack-md">
          <View>
            <Text className="field-label">{t("日期")}</Text>
            <Input className="input" value={sessionDraft.date} onInput={(event) => setSessionDraft({ ...sessionDraft, date: event.detail.value })} />
          </View>

          <View>
            <Text className="field-label">{t("地点")}</Text>
            <Input
              className={`input ${activeOpenBetaSessionPrefill?.locationName ? "locked-field" : ""}`}
              value={sessionDraft.locationName ?? ""}
              placeholder={t("岩馆 / 岩场 / 训练板")}
              disabled={Boolean(activeOpenBetaSessionPrefill?.locationName)}
              onInput={(event) => setSessionDraft({ ...sessionDraft, locationName: event.detail.value })}
            />
          </View>

          <View>
            <Text className="field-label">{t("攀岩类型")}</Text>
            <View className="choice-group">
              {DISCIPLINE_OPTIONS.map((option) => (
                <View
                  key={option.value}
                  className={`choice-chip ${sessionDraft.discipline === option.value ? "active" : ""} ${activeOpenBetaSessionPrefill?.discipline ? "locked-chip" : ""}`}
                  onClick={() => {
                    if (!activeOpenBetaSessionPrefill?.discipline) {
                      setSessionDraft({
                        ...sessionDraft,
                        discipline: option.value,
                        disciplineOtherText: option.value === "other" ? sessionDraft.disciplineOtherText ?? "" : undefined
                      });
                    }
                  }}
                >
                  {option.label}
                </View>
              ))}
            </View>
          </View>

          {sessionDraft.discipline === "other" ? (
            <View>
              <Text className="field-label">补充类型</Text>
              <Input
                className="input"
                value={sessionDraft.disciplineOtherText ?? ""}
                placeholder="例如 speed / trad / 校园板 / 其他训练"
                onInput={(event) => setSessionDraft({ ...sessionDraft, disciplineOtherText: event.detail.value })}
              />
            </View>
          ) : null}

          <View className="row">
            <View style={{ flex: 1 }}>
              <Text className="field-label">{t("时长（分钟）")}</Text>
              <Input className="input" type="number" value={sessionDraft.durationMinutes ? String(sessionDraft.durationMinutes) : ""} onInput={(event) => setSessionDraft({ ...sessionDraft, durationMinutes: Number(event.detail.value) || undefined })} />
            </View>
            <RatingSelector label={t("精力 1-5")} value={sessionDraft.energyRating ?? 3} onChange={(value) => setSessionDraft({ ...sessionDraft, energyRating: value })} />
          </View>

          <View className="row">
            <RatingSelector label={t("疲劳 1-5")} value={sessionDraft.fatigueRating ?? 3} onChange={(value) => setSessionDraft({ ...sessionDraft, fatigueRating: value })} />
            <RatingSelector label={t("情绪 1-5")} value={sessionDraft.moodRating ?? 3} onChange={(value) => setSessionDraft({ ...sessionDraft, moodRating: value })} />
          </View>

          <View>
            <Text className="field-label">{t("今日总结")}</Text>
            <Textarea className="textarea" value={sessionDraft.summary ?? ""} onInput={(event) => setSessionDraft({ ...sessionDraft, summary: event.detail.value })} />
          </View>
        </View>
      </Card>

      <Card>
        <View className="row-between">
          <View>
            <View className="card-title">{editingSessionId ? t("更新前检查") : t("保存前检查")}</View>
            <View className="card-subtitle">{draftClimbs.length ? `本次 Session 已暂存 ${draftClimbs.length} 条 Climb。每个 Session 只保留当天最值得记录的一条线。` : "还没有暂存 Climb，保存前需要 1 条。"}</View>
          </View>
          <View className="pill">{draftClimbs.length} 条</View>
        </View>
      </Card>

      <SectionTitle>{draftClimbs.length ? t("本次已添加 Climb") : t("本次 Climb 草稿")}</SectionTitle>
      {draftClimbs.length ? (
        draftClimbs.map((climb) => (
          <Card key={climb.id}>
            <View className="row-between">
              <View>
                <View className="card-title">
                  {climb.gradeLabel || t("未填写难度")} · {climb.outcome ? OUTCOME_LABELS[climb.outcome] : t("未填写状态")}
                </View>
                <View className="card-subtitle">恐惧感 {climb.fearRating} / 5 · {climb.attemptsCount ? `${climb.attemptsCount} 次` : climb.attemptsBucket}</View>
              </View>
              <View className="row">
                <Button className="ghost-button" onClick={() => openSheetForEdit(climb.id)}>
                  编辑
                </Button>
                <Button className="ghost-button" onClick={() => removeDraftClimb(climb.id)}>
                  删除
                </Button>
              </View>
            </View>
            <View style={{ marginTop: "16px" }}>
              <PillRow items={[...(climb.tags.length ? climb.tags : [t("未选动作标签")]), ...(climb.addToProject ? [t("已加入 Project")] : [])]} />
            </View>
            {climb.addToProject ? (
              <View className="card-subtitle">
                Project：{climb.newProjectTitle?.trim() || projects.find((project) => project.id === climb.selectedProjectId)?.title || t("未命名")}
              </View>
            ) : null}
            {climb.outcome === "sent" && climb.ascentStyle ? <View className="card-subtitle">{t("完攀方式：")}{climb.ascentStyle}</View> : null}
            {climb.outcome && climb.outcome !== "sent" && climb.attemptOutcome ? <View className="card-subtitle">{t("本次结果：")}{climb.attemptOutcome}</View> : null}
            {climb.mediaItems.length ? <View className="card-subtitle">媒体：{climb.mediaItems.length} 个</View> : null}
          </Card>
        ))
      ) : (
        <EmptyState title="先加一条 Climb。真正有用的记录，来自一次次具体尝试。" />
      )}

      <View className="row">
        <Button className="secondary-button" onClick={openSheet}>
          {draftClimbs.length ? t("编辑 Climb") : t("+ 添加 Climb")}
        </Button>
        <Button className="primary-button" loading={isSaving} onClick={handleSaveSession}>
          {editingSessionId ? t("更新 Session") : t("保存 Session")}
        </Button>
      </View>

      <SectionTitle>{t("历史 Session")}</SectionTitle>
      <Card>
        <View className="field-label">{t("搜索 Session")}</View>
        <Input
          className="input"
          value={sessionSearchQuery}
          placeholder={t("搜索日期、地点、难度、标签、结果或备注")}
          onInput={(event) => setSessionSearchQuery(event.detail.value)}
        />
      </Card>
      {filteredSessions.length ? (
        filteredSessions.map((session) => {
          const sessionClimbs = climbs.filter((climb) => climb.sessionId === session.id);
          const disciplineLabel = session.discipline === "other" ? session.disciplineOtherText ?? "其他" : session.discipline;
          const timeLabel = formatSessionActivityTime(session);

          return (
            <Card key={session.id}>
              <View className="row-between">
                <View>
                  <View className="card-title">{session.locationName ?? t("未填写地点")}</View>
                  <View className="card-subtitle">
                    {[session.date, timeLabel, disciplineLabel, `${sessionClimbs.length} 条 Climb`].filter(Boolean).join(" · ")}
                  </View>
                </View>
                <View className="row">
                  <View className="pill">{sessionClimbs.length}</View>
                  <Button className="ghost-button" onClick={() => handleEditSession(session.id)}>
                    {editingSessionId === session.id ? t("正在编辑") : t("编辑")}
                  </Button>
                  <Button className="ghost-button danger-button" onClick={() => handleDeleteSession(session.id)}>
                    {t("删除")}
                  </Button>
                </View>
              </View>
              <View style={{ marginTop: "12px" }}>
                <PillRow items={sessionClimbs.length ? sessionClimbs.map((climb) => `${climb.gradeLabel} · ${OUTCOME_LABELS[climb.outcome]}`) : ["还没有 Climb"]} />
              </View>
              {session.summary ? <View className="card-subtitle">{session.summary}</View> : null}
            </Card>
          );
        })
      ) : (
        <EmptyState title={sessionSearchQuery.trim() ? "没有匹配的 Session。" : "还没有历史 Session。保存第一条之后，这里会开始累积。"} />
      )}

      <Card>
        <View className="row-between">
          <View>
            <View className="card-title">{t("今日攀岩结束了吗？")}</View>
            <View className="card-subtitle">{t("来看看自己的成果吧。会按今天所有已保存的 Session 实时生成。")}</View>
          </View>
          <Button className="primary-button" onClick={handleGenerateTodayShareCard}>
            {t("生成今日卡")}
          </Button>
        </View>
      </Card>

      <ClimbSheet
        visible={sheetVisible}
        projects={projectOptions}
        discipline={sessionDraft.discipline}
        sessionLocationName={sessionDraft.locationName}
        initialValue={editorDraft}
        lockedFields={
          activeOpenBetaSessionPrefill
            ? {
                gradeLabel: Boolean(activeOpenBetaSessionPrefill.gradeLabel),
                gradeSystem: Boolean(activeOpenBetaSessionPrefill.gradeSystem),
                routeReferenceId: Boolean(activeOpenBetaSessionPrefill.routeReferenceId)
              }
            : undefined
        }
        submitLabel={editingDraftId ? "更新这条 Climb" : "保存到本次 Session"}
        onClose={() => {
          setSheetVisible(false);
          setEditingDraftId(undefined);
        }}
        onSave={(draft) => {
          setDraftClimbs(editingDraftId ? draftClimbs.map((item) => (item.id === editingDraftId ? draft : item)) : [draft]);
          setSheetVisible(false);
          setEditingDraftId(undefined);
        }}
      />
      <ShareCardModal visible={Boolean(shareCard)} card={shareCard} onClose={() => setShareCard(undefined)} />
    </>
  );

  if (!showHeader) {
    return body;
  }

  return (
    <View className="page">
      <PageHeader title={t("记录一次完整攀岩")} subtitle={t("登录后直接写入服务端数据，不再依赖本地业务存储。")} showBack />
      {body}
    </View>
  );
}
