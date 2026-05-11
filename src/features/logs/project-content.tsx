import { Button, Input, Textarea, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useState } from "react";
import { Card, EmptyState, PageHeader, PillRow, SectionTitle } from "@/components/common";
import { ShareCardModal } from "@/components/share-card-modal";
import { OUTCOME_LABELS } from "@/constants/climbing";
import { useBootstrapData } from "@/hooks/use-bootstrap-data";
import { useI18n } from "@/i18n";
import { useProtectedPage } from "@/hooks/use-protected-page";
import { createId, deleteProject, nowIso, saveProject, updateProject } from "@/services/repositories";
import { Climb, ClimbingSession, Project, ShareCard } from "@/types/domain";
import { buildGradeInfo } from "@/utils/grade";
import { switchToLogs } from "@/utils/logs-navigation";
import type { OpenBetaLogPrefill } from "@/utils/logs-navigation";
import { getProjectStats } from "@/utils/metrics";
import { buildProjectSendCard } from "@/utils/share-cards";

const PROJECT_STATUS_OPTIONS: Array<{ value: Project["status"]; label: string }> = [
  { value: "active", label: "进行中" },
  { value: "sent", label: "已完成" },
  { value: "paused", label: "暂停" },
  { value: "abandoned", label: "搁置" }
];

type ProjectStatusFilter = "active" | "sent" | "paused_abandoned";

const PROJECT_FILTERS: Array<{ value: ProjectStatusFilter; label: string }> = [
  { value: "active", label: "Active" },
  { value: "sent", label: "Sent" },
  { value: "paused_abandoned", label: "Paused / Abandoned" }
];

function createEmptyProjectForm() {
  return {
    title: "",
    locationName: "",
    gradeLabel: "",
    tags: "",
    betaNotes: "",
    routeReferenceId: "",
    linkedRouteId: "",
    linkedRouteSource: undefined as Project["linkedRouteSource"] | undefined,
    status: "active" as Project["status"]
  };
}

function truncateText(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function matchesProjectStatusFilter(project: Project, filter: ProjectStatusFilter) {
  if (filter === "paused_abandoned") {
    return project.status === "paused" || project.status === "abandoned";
  }

  return project.status === filter;
}

function normalizeProjectIdentityValue(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function hasDuplicateProjectIdentity(
  projects: Project[],
  fields: { title: string; locationName?: string; gradeLabel: string; routeReferenceId?: string },
  editingProjectId?: string
) {
  const routeReferenceId = normalizeProjectIdentityValue(fields.routeReferenceId);
  const title = normalizeProjectIdentityValue(fields.title);
  const locationName = normalizeProjectIdentityValue(fields.locationName);
  const gradeLabel = normalizeProjectIdentityValue(fields.gradeLabel);

  return projects.some((project) => {
    if (project.id === editingProjectId) {
      return false;
    }

    const projectRouteReferenceId = normalizeProjectIdentityValue(project.routeReferenceId);

    if (routeReferenceId && projectRouteReferenceId && projectRouteReferenceId === routeReferenceId) {
      return true;
    }

    return (
      title &&
      gradeLabel &&
      normalizeProjectIdentityValue(project.title) === title &&
      normalizeProjectIdentityValue(project.locationName) === locationName &&
      normalizeProjectIdentityValue(project.gradeLabel) === gradeLabel
    );
  });
}

function Section({
  title,
  projects,
  onOpenDetails,
  selectedId,
  climbs,
  sessions
}: {
  title: string;
  projects: Project[];
  onOpenDetails: (project: Project) => void;
  selectedId?: string;
  climbs: ReturnType<typeof useBootstrapData>["climbs"];
  sessions: ReturnType<typeof useBootstrapData>["sessions"];
}) {
  const { language, t } = useI18n();

  if (!projects.length) {
    return <EmptyState title={language === "en" ? `${title} is empty.` : `${title} 暂时为空。`} />;
  }

  return (
    <>
      {projects.map((project) => {
        const stats = getProjectStats(project, climbs, sessions);
        const fearText = stats.firstFear && stats.latestFear ? `${stats.firstFear} → ${stats.latestFear}` : t("数据不足");
        const relatedClimbCount = climbs.filter((climb) => climb.projectId === project.id).length;

        return (
          <Card key={project.id}>
            <View className="row-between">
              <View>
                <View className="card-title">{project.title}</View>
                <View className="card-subtitle">
                  {project.gradeLabel} · {project.locationName ?? t("未填写地点")} · {t(project.status)}
                </View>
              </View>
              <Button className={selectedId === project.id ? "secondary-button" : "ghost-button"} onClick={() => onOpenDetails(project)}>
                {t("详情")}
              </Button>
            </View>
            <View className="card-subtitle" style={{ marginTop: "12px" }}>
              {language === "en" ? `${relatedClimbCount} linked Climbs · ${stats.totalSessions} Sessions` : `关联 ${relatedClimbCount} 条 Climb · 覆盖 ${stats.totalSessions} 次 Session`}
            </View>
            <View className="metric-grid" style={{ marginTop: "16px" }}>
              <View className="metric-card">
                <View className="metric-name">{t("累计尝试")}</View>
                <View className="metric-value">{stats.totalAttempts}</View>
                <View className="metric-note">{t("不是只有完成，尝试本身也算数。")}</View>
              </View>
              <View className="metric-card">
                <View className="metric-name">{t("恐惧变化")}</View>
                <View className="metric-value">{fearText}</View>
                <View className="metric-note">{t("更敢面对，通常先于更高难度出现。")}</View>
              </View>
            </View>
            <View style={{ marginTop: "16px" }}>
              <PillRow items={project.tags} />
            </View>
          </Card>
        );
      })}
    </>
  );
}

function ProjectSessionSheet({
  project,
  climbs,
  sessions,
  onClose,
  onOpenSession
}: {
  project?: Project;
  climbs: Climb[];
  sessions: ClimbingSession[];
  onClose: () => void;
  onOpenSession: (sessionId: string) => void;
}) {
  const [isBetaExpanded, setIsBetaExpanded] = useState(false);
  const { language, t } = useI18n();

  if (!project) {
    return null;
  }

  const betaNotes = project.betaNotes?.trim();
  const shouldCollapseBeta = Boolean(betaNotes && betaNotes.length > 56);
  const betaText = betaNotes ? (isBetaExpanded ? betaNotes : truncateText(betaNotes, 56)) : t("还没有写 beta 笔记。");
  const relatedClimbs = climbs
    .filter((climb) => climb.projectId === project.id)
    .sort((left, right) => {
      const leftSession = sessions.find((session) => session.id === left.sessionId);
      const rightSession = sessions.find((session) => session.id === right.sessionId);
      return String(rightSession?.date || right.createdAt).localeCompare(String(leftSession?.date || left.createdAt));
    });

  return (
    <View className="sheet-backdrop" onClick={onClose}>
      <View className="sheet project-session-sheet" onClick={(event) => event.stopPropagation()}>
        <View className="row-between">
          <View>
            <View className="page-title">{project.title}</View>
            <View className="page-subtitle">{t("这个 Project 关联的具体 Session 记录。")}</View>
          </View>
          <Button className="ghost-button" onClick={onClose}>
            {t("关闭")}
          </Button>
        </View>

        <View className="project-sheet-meta">
          <View className="field-label">{t("标签")}</View>
          <PillRow items={project.tags.length ? project.tags : [t("未填写标签")]} />
          <View className="project-beta-preview">
            <View className="field-label">{t("Beta 笔记")}</View>
            <View className="project-beta-text">{betaText}</View>
            {shouldCollapseBeta ? (
              <View className="project-beta-action" onClick={() => setIsBetaExpanded(!isBetaExpanded)}>
                {isBetaExpanded ? t("收起") : t("详情")}
              </View>
            ) : null}
          </View>
        </View>

        <View className="divider" />
        <View className="stack-sm">
          {relatedClimbs.length ? (
            relatedClimbs.map((climb) => {
              const session = sessions.find((item) => item.id === climb.sessionId);
              const outcomeClass = climb.outcome === "sent" ? "" : climb.outcome === "in_progress" ? "in-progress" : "not-sent";
              const failureText = climb.failureReasons.length ? climb.failureReasons.join("、") : climb.attemptOutcome;

              return (
                <View key={climb.id} className="list-item project-session-item" onClick={() => session && onOpenSession(session.id)}>
                  <View className="session-summary-row">
                    <View>
                      <View className="card-title">{session?.date ?? t("未记录时间")}</View>
                      <View className="card-subtitle">
                        {[session?.locationName, climb.gradeLabel, climb.attemptsCount ? (language === "en" ? `${climb.attemptsCount} attempts` : `${climb.attemptsCount} 次尝试`) : climb.attemptsBucket]
                          .filter(Boolean)
                          .join(" · ")}
                      </View>
                    </View>
                    <View className={`session-outcome ${outcomeClass}`}>{OUTCOME_LABELS[climb.outcome]}</View>
                  </View>
                  <View className="card-subtitle">{t("心理恐惧程度：")}{climb.fearRating} / 5</View>
                  {climb.outcome !== "sent" && failureText ? <View className="card-subtitle tag-danger">{t("失败原因：")}{failureText}</View> : null}
                  {session ? <View className="project-session-link">{t("查看完整 Session")}</View> : null}
                </View>
              );
            })
          ) : (
            <EmptyState title="还没有关联到这个 Project 的 Session。" />
          )}
        </View>
      </View>
    </View>
  );
}

export function ProjectLogsContent({
  showHeader = true,
  openBetaPrefill,
  onRequestSessionView,
  onRequestSessionEdit
}: {
  showHeader?: boolean;
  openBetaPrefill?: OpenBetaLogPrefill;
  onRequestSessionView?: () => void;
  onRequestSessionEdit?: (sessionId: string) => void;
}) {
  const auth = useProtectedPage();
  const { language, t } = useI18n();
  const { projects, climbs, sessions, isLoading, reload } = useBootstrapData(auth.isAuthenticated && !auth.isLoading);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [editingProjectId, setEditingProjectId] = useState<string | undefined>();
  const [sessionSheetProjectId, setSessionSheetProjectId] = useState<string | undefined>();
  const [shareCard, setShareCard] = useState<ShareCard | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectStatusFilter, setProjectStatusFilter] = useState<ProjectStatusFilter>("active");
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [projectForm, setProjectForm] = useState(createEmptyProjectForm);
  const [activeOpenBetaProjectPrefill, setActiveOpenBetaProjectPrefill] = useState<OpenBetaLogPrefill | undefined>();
  const [externalProjectBetaNotes, setExternalProjectBetaNotes] = useState<string | undefined>();

  useEffect(() => {
    if (!projects.length) {
      setSelectedProjectId(undefined);
      return;
    }

    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const sessionSheetProject = projects.find((project) => project.id === sessionSheetProjectId);
  const relatedClimbs = selectedProject ? climbs.filter((climb) => climb.projectId === selectedProject.id) : [];
  const normalizedProjectSearch = projectSearchQuery.trim().toLowerCase();
  const searchedProjects = normalizedProjectSearch
    ? projects.filter((project) => {
        const searchableText = [
          project.title,
          project.locationName,
          project.gradeLabel,
          project.status,
          project.betaNotes,
          ...project.tags
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedProjectSearch);
      })
    : projects;
  const filteredProjects = searchedProjects.filter((project) => matchesProjectStatusFilter(project, projectStatusFilter));
  const canImportProjectBeta = Boolean(activeOpenBetaProjectPrefill && externalProjectBetaNotes?.trim());
  const projectBetaImportLabel = activeOpenBetaProjectPrefill
    ? canImportProjectBeta
      ? "导入 OpenBeta 笔记"
      : "暂无 OpenBeta 笔记"
    : "不可导入";

  function resetProjectForm() {
    setEditingProjectId(undefined);
    setProjectForm(createEmptyProjectForm());
    setActiveOpenBetaProjectPrefill(undefined);
    setExternalProjectBetaNotes(undefined);
  }

  function handleGoToSessionView() {
    if (onRequestSessionView) {
      onRequestSessionView();
      return;
    }

    void switchToLogs("session");
  }

  function handleOpenSessionEdit(sessionId: string) {
    setSessionSheetProjectId(undefined);

    if (onRequestSessionEdit) {
      onRequestSessionEdit(sessionId);
      return;
    }

    void switchToLogs("session", { editSessionId: sessionId });
  }

  function buildProjectShareCard(project: Project) {
    if (!auth.user) {
      return undefined;
    }

    const stats = getProjectStats(project, climbs, sessions);
    const fearDelta = stats.firstFear && stats.latestFear ? `${stats.firstFear} -> ${stats.latestFear}` : undefined;
    return buildProjectSendCard(auth.user.id, project, stats.totalAttempts, stats.totalSessions, fearDelta);
  }

  function handleOpenProjectSessions(project: Project) {
    setSelectedProjectId(project.id);
    setSessionSheetProjectId(project.id);
  }

  function handleGenerateProjectShareCard(project: Project) {
    const nextCard = buildProjectShareCard(project);

    if (!nextCard) {
      return;
    }

    setShareCard(nextCard);
  }

  async function handleMarkSent() {
    if (!selectedProject || !auth.user) {
      return;
    }

    try {
      const sentDate = new Date().toISOString().slice(0, 10);
      const updated = {
        ...selectedProject,
        status: "sent" as const,
        sentDate,
        updatedAt: new Date().toISOString()
      };

      await updateProject(updated);

      const nextCard = buildProjectShareCard(updated);
      await reload();
      Taro.showToast({ title: t("已标记完攀"), icon: "success" });
      setShareCard(nextCard);
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : t("更新失败"), icon: "none" });
    }
  }

  async function handleDeleteProject(project: Project) {
    const confirmed = await Taro.showModal({
      title: t("删除 Project"),
      content:
        language === "en"
          ? `Delete Project "${project.title}"? Historical Sessions will stay, but related Climbs will be unlinked from this Project.`
          : `确定删除 Project「${project.title}」吗？历史 Session 不会被删除，但会解除这些 Climb 和该 Project 的关联。`,
      confirmText: t("删除"),
      confirmColor: "#B3261E",
      cancelText: t("取消")
    });

    if (!confirmed.confirm) {
      return;
    }

    try {
      await deleteProject(project.id);
      if (editingProjectId === project.id) {
        resetProjectForm();
      }
      if (selectedProjectId === project.id) {
        setSelectedProjectId(undefined);
      }
      if (sessionSheetProjectId === project.id) {
        setSessionSheetProjectId(undefined);
      }
      await reload();
      Taro.showToast({ title: t("Project 已删除"), icon: "success" });
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : t("删除失败"), icon: "none" });
    }
  }

  function handleStartEditProject() {
    if (!selectedProject) {
      return;
    }

    setEditingProjectId(selectedProject.id);
    setActiveOpenBetaProjectPrefill(undefined);
    setProjectForm({
      title: selectedProject.title,
      locationName: selectedProject.locationName ?? "",
      gradeLabel: selectedProject.gradeLabel,
      tags: selectedProject.tags.join(", "),
      betaNotes: selectedProject.betaNotes ?? "",
      routeReferenceId: selectedProject.routeReferenceId ?? "",
      linkedRouteId: selectedProject.linkedRouteId ?? "",
      linkedRouteSource: selectedProject.linkedRouteSource,
      status: selectedProject.status
    });
    void Taro.pageScrollTo({ scrollTop: 0, duration: 0 }).catch(() => undefined);
  }

  useEffect(() => {
    if (!openBetaPrefill || openBetaPrefill.target !== "project") {
      return;
    }

    setEditingProjectId(undefined);
    setActiveOpenBetaProjectPrefill(openBetaPrefill);
    setExternalProjectBetaNotes(openBetaPrefill.betaNotes);
    setProjectForm({
      title: openBetaPrefill.routeName,
      locationName: openBetaPrefill.locationName,
      gradeLabel: openBetaPrefill.gradeLabel ?? "",
      tags: openBetaPrefill.climbTypeLabel ?? "",
      betaNotes: "",
      routeReferenceId: openBetaPrefill.routeReferenceId,
      linkedRouteId: openBetaPrefill.routeReferenceId,
      linkedRouteSource: "openbeta_route",
      status: "active"
    });
    void Taro.pageScrollTo({ scrollTop: 0, duration: 0 }).catch(() => undefined);
  }, [openBetaPrefill?.id]);

  async function handleSubmitProject() {
    if (!auth.user) {
      return;
    }

    if (!projectForm.title.trim() || !projectForm.gradeLabel.trim()) {
      Taro.showToast({ title: t("请至少填写 Project 名称和难度"), icon: "none" });
      return;
    }

    setIsSubmitting(true);

    try {
      const now = nowIso();
      const gradeInfo = buildGradeInfo(projectForm.gradeLabel.trim());
      const nextStatus = projectForm.status;
      const commonFields = {
        title: projectForm.title.trim(),
        locationName: projectForm.locationName.trim() || undefined,
        gradeLabel: projectForm.gradeLabel.trim(),
        gradeSystem: gradeInfo.gradeSystem,
        normalizedGradeValue: gradeInfo.normalizedGradeValue,
        status: nextStatus,
        tags: projectForm.tags
          .split(/[,，]/)
          .map((item) => item.trim())
          .filter(Boolean),
        betaNotes: projectForm.betaNotes.trim() || undefined,
        routeReferenceId: projectForm.routeReferenceId.trim() || undefined,
        linkedRouteId: projectForm.linkedRouteId.trim() || undefined,
        linkedRouteSource: projectForm.linkedRouteSource
      };

      if (hasDuplicateProjectIdentity(projects, commonFields, editingProjectId)) {
        Taro.showToast({
          title: commonFields.routeReferenceId
            ? "这条路线已经有 Project。请直接继续记录已有 Project。"
            : "已经有同名、同地点、同难度的 Project。为了列表里更好区分，请换一个名字。",
          icon: "none"
        });
        return;
      }

      let saved: Project;

      if (editingProjectId) {
        const currentProject = projects.find((project) => project.id === editingProjectId);

        if (!currentProject) {
          Taro.showToast({ title: t("Project 不存在"), icon: "none" });
          return;
        }

        saved = await updateProject({
          ...currentProject,
          ...commonFields,
          sentDate: nextStatus === "sent" ? currentProject.sentDate ?? new Date().toISOString().slice(0, 10) : undefined,
          updatedAt: now
        });
      } else {
        saved = await saveProject({
          id: createId("project"),
          userId: auth.user.id,
          ...commonFields,
          sentDate: nextStatus === "sent" ? new Date().toISOString().slice(0, 10) : undefined,
          createdAt: now,
          updatedAt: now
        });
      }

      await reload();
      setSelectedProjectId(saved.id);
      resetProjectForm();
      Taro.showToast({ title: editingProjectId ? t("Project 已更新") : t("Project 已创建"), icon: "success" });
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : editingProjectId ? t("更新失败") : t("创建失败"), icon: "none" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const body = (
    <>
      <Card>
        <View className="row-between">
          <View>
            <View className="card-title">{t("继续记录")}</View>
            <View className="card-subtitle">{t("Project 本身不直接写记录，新的尝试请回到 Session 里添加。")}</View>
          </View>
          <Button className="primary-button" onClick={handleGoToSessionView}>
            {t("去记录")}
          </Button>
        </View>
      </Card>

      <Card>
        <View className="card-title">{editingProjectId ? t("编辑 Project") : t("新建 Project")}</View>
        <View className="card-subtitle">{editingProjectId ? t("这里改的是已保存的 Project 信息。") : t("不用先去 Record 里带出，直接在这里建一个长期目标。")}</View>
        {activeOpenBetaProjectPrefill ? (
          <View className="locked-prefill-note">
            <View className="row-between">
              <View className="eyebrow-row">
                <View className="status-dot blue" />
                <View className="eyebrow-text">OPENBETA PREFILL</View>
              </View>
              <Button className="ghost-button" onClick={resetProjectForm}>
                {t("取消导入")}
              </Button>
            </View>
            <View className="card-subtitle">{t("线路名、地点、难度和 OpenBeta ID 已锁定。状态、标签和 beta 笔记仍可补充。")}</View>
          </View>
        ) : null}
        <View className="stack-md" style={{ marginTop: "14px" }}>
          <View>
            <View className="field-label">{t("名称")}</View>
            <Input
              className={`input ${activeOpenBetaProjectPrefill?.routeName ? "locked-field" : ""}`}
              value={projectForm.title}
              placeholder={t("例如 黄线屋檐 Project")}
              disabled={Boolean(activeOpenBetaProjectPrefill?.routeName)}
              onInput={(event) => setProjectForm({ ...projectForm, title: event.detail.value })}
            />
          </View>
          <View className="row">
            <View style={{ flex: 1 }}>
              <View className="field-label">{t("地点")}</View>
              <Input
                className={`input ${activeOpenBetaProjectPrefill?.locationName ? "locked-field" : ""}`}
                value={projectForm.locationName}
                placeholder={t("岩馆 / 岩场")}
                disabled={Boolean(activeOpenBetaProjectPrefill?.locationName)}
                onInput={(event) => setProjectForm({ ...projectForm, locationName: event.detail.value })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View className="field-label">{t("难度")}</View>
              <Input
                className={`input ${activeOpenBetaProjectPrefill?.gradeLabel ? "locked-field" : ""}`}
                value={projectForm.gradeLabel}
                placeholder="V4 / 6B / 5.11a"
                disabled={Boolean(activeOpenBetaProjectPrefill?.gradeLabel)}
                onInput={(event) => setProjectForm({ ...projectForm, gradeLabel: event.detail.value })}
              />
            </View>
          </View>
          <View>
            <View className="field-label">{t("状态")}</View>
            <View className="choice-group">
              {PROJECT_STATUS_OPTIONS.map((option) => (
                <View
                  key={option.value}
                  className={`choice-chip ${projectForm.status === option.value ? "active" : ""}`}
                  onClick={() => setProjectForm({ ...projectForm, status: option.value })}
                >
                  {option.label}
                </View>
              ))}
            </View>
          </View>
          <View>
            <View className="field-label">{t("标签")}</View>
            <Input
              className="input"
              value={projectForm.tags}
              placeholder={language === "en" ? "e.g. overhang, fear, compression" : "例如 overhang, fear, compression"}
              onInput={(event) => setProjectForm({ ...projectForm, tags: event.detail.value })}
            />
          </View>
          <View>
            <View className="field-label">{t("Beta 笔记")}</View>
            <View className={`external-beta-import ${canImportProjectBeta ? "" : "disabled"}`}>
              <View className="card-subtitle">OpenBeta Notes</View>
              <Button
                className={`secondary-button beta-import-button ${canImportProjectBeta ? "" : "disabled"}`}
                disabled={!canImportProjectBeta}
                onClick={() => {
                  if (canImportProjectBeta) {
                    setProjectForm({ ...projectForm, betaNotes: externalProjectBetaNotes ?? "" });
                  }
                }}
              >
                {projectBetaImportLabel}
              </Button>
            </View>
            <Textarea
              className="textarea"
              value={projectForm.betaNotes}
              placeholder={t("先记下为什么想反复回来。")}
              onInput={(event) => setProjectForm({ ...projectForm, betaNotes: event.detail.value })}
            />
          </View>
          <View className="row">
            {editingProjectId ? (
              <Button className="ghost-button" onClick={resetProjectForm}>
                {t("取消编辑")}
              </Button>
            ) : null}
            <Button className="primary-button" loading={isSubmitting} onClick={handleSubmitProject}>
              {editingProjectId ? t("保存修改") : t("创建 Project")}
            </Button>
          </View>
        </View>
      </Card>

      <SectionTitle>{t("Project 列表")}</SectionTitle>
      <Card>
        <View className="field-label">{t("搜索 Project")}</View>
        <Input
          className="input"
          value={projectSearchQuery}
          placeholder={t("搜索名称、地点、难度、标签或 beta")}
          onInput={(event) => setProjectSearchQuery(event.detail.value)}
        />
        <View className="project-filter-tabs">
          {PROJECT_FILTERS.map((filter) => {
            const count = searchedProjects.filter((project) => matchesProjectStatusFilter(project, filter.value)).length;

            return (
              <View
                key={filter.value}
                className={`choice-chip ${projectStatusFilter === filter.value ? "active" : ""}`}
                onClick={() => setProjectStatusFilter(filter.value)}
              >
                {filter.label} {count}
              </View>
            );
          })}
        </View>
      </Card>

      {isLoading ? (
        <EmptyState title="正在加载 Project…" />
      ) : (
        <Section
          title={PROJECT_FILTERS.find((filter) => filter.value === projectStatusFilter)?.label ?? "Project"}
          projects={filteredProjects}
          onOpenDetails={handleOpenProjectSessions}
          selectedId={selectedProjectId}
          climbs={climbs}
          sessions={sessions}
        />
      )}

      {selectedProject ? (
        <>
          <SectionTitle>{t("Project 详情")}</SectionTitle>
          <Card>
            <View className="row-between">
              <View className="card-title">{selectedProject.title}</View>
              <View className="row">
                <Button className="ghost-button" onClick={handleStartEditProject}>
                  {t("编辑 Project")}
                </Button>
                <Button className="ghost-button danger-button" onClick={() => handleDeleteProject(selectedProject)}>
                  {t("删除")}
                </Button>
              </View>
            </View>
            <View className="card-subtitle">{selectedProject.betaNotes ?? t("还没有写 beta 笔记。")}</View>
            <View className="divider" />
            <View className="stack-sm">
              <View>RouteReference: {selectedProject.routeReferenceId ?? "P0 预留字段，当前为空"}</View>
              <View>
                {t("第一次尝试：")}
                {selectedProject.firstAttemptDate ?? t("未记录")}
              </View>
              <View>
                {t("最近一次尝试：")}
                {selectedProject.lastAttemptDate ?? t("未记录")}
              </View>
              <View>
                {t("媒体：")}
                {relatedClimbs.flatMap((climb) => climb.mediaIds).length} {t("个资源")}
              </View>
            </View>
            <SectionTitle>{t("Timeline")}</SectionTitle>
            <View className="stack-sm">
              {relatedClimbs.length ? (
                relatedClimbs.map((climb) => (
                  <View key={climb.id} className="list-item">
                    <View>{climb.gradeLabel} · {climb.outcome}</View>
                    <View className="card-subtitle">{climb.notes ?? climb.betaNotes ?? t("这次没有写备注。")}</View>
                  </View>
                ))
              ) : (
                <View className="muted">{t("还没有关联到这条 Project 的 Climb。")}</View>
              )}
            </View>
            {selectedProject.status !== "sent" ? (
              <Button className="primary-button" style={{ marginTop: "20px" }} onClick={handleMarkSent}>
                {t("标记为 Sent")}
              </Button>
            ) : null}
            <Button className={selectedProject.status === "sent" ? "primary-button" : "secondary-button"} style={{ marginTop: "12px" }} onClick={() => handleGenerateProjectShareCard(selectedProject)}>
              {t("生成分享卡")}
            </Button>
          </Card>
        </>
      ) : null}

      <ProjectSessionSheet
        project={sessionSheetProject}
        climbs={climbs}
        sessions={sessions}
        onClose={() => setSessionSheetProjectId(undefined)}
        onOpenSession={handleOpenSessionEdit}
      />
      <ShareCardModal visible={Boolean(shareCard)} card={shareCard} onClose={() => setShareCard(undefined)} />
    </>
  );

  if (!showHeader) {
    return body;
  }

  return (
    <View className="page">
      <PageHeader title="Project" subtitle="Track the project that keeps asking for another try." showBack />
      {body}
    </View>
  );
}
