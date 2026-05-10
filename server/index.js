const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const app = express();
const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || "0.0.0.0";
const JWT_SECRET = process.env.JWT_SECRET || "climbing-grit-journal-dev-secret";
const DEFAULT_DB_DIR = path.join(__dirname, "data");
const configuredDbPath = process.env.DB_PATH && process.env.DB_PATH.trim();
const configuredDbDir =
  (process.env.DB_DIR && process.env.DB_DIR.trim()) ||
  (process.env.RAILWAY_VOLUME_MOUNT_PATH && process.env.RAILWAY_VOLUME_MOUNT_PATH.trim());
const DB_PATH = configuredDbPath
  ? path.resolve(configuredDbPath)
  : path.join(configuredDbDir ? path.resolve(configuredDbDir) : DEFAULT_DB_DIR, "db.json");
const DB_DIR = path.dirname(DB_PATH);
const OPENBETA_GRAPHQL_URL = process.env.OPENBETA_GRAPHQL_URL || "https://api.openbeta.io";
const OPENBETA_DOWNLOAD_LIMIT = Number(process.env.OPENBETA_DOWNLOAD_LIMIT || 180);
const OPENBETA_DOWNLOADABLE_REGIONS_CACHE_MS = Number(process.env.OPENBETA_DOWNLOADABLE_REGIONS_CACHE_MS || 10 * 60 * 1000);
let openBetaDownloadableRegionsCache = {
  loadedAt: 0,
  groups: []
};

const OPENBETA_AREA_SUMMARY_FIELDS = `
  uuid
  area_name
  totalClimbs
  ancestors
  pathTokens
  metadata {
    lat
    lng
    leaf
    isDestination
  }
`;

const OPENBETA_CLIMB_FIELDS = `
  uuid
  name
  grades {
    yds
    vscale
    font
    french
  }
  gradeContext
  type {
    trad
    sport
    bouldering
    tr
    ice
    mixed
    aid
  }
  metadata {
    lat
    lng
  }
  content {
    description
    location
    protection
  }
`;

const OPENBETA_AREA_SEARCH_QUERY = `
  query SearchAreas($query: String!, $limit: Int!) {
    areas(filter: { area_name: { match: $query } }, sort: { totalClimbs: -1 }, limit: $limit) {
      ${OPENBETA_AREA_SUMMARY_FIELDS}
    }
  }
`;

const OPENBETA_COUNTRIES_QUERY = `
  query Countries {
    countries {
      ${OPENBETA_AREA_SUMMARY_FIELDS}
    }
  }
`;

const OPENBETA_AREA_DETAIL_QUERY = `
  query AreaDetail($uuid: ID) {
    area(uuid: $uuid) {
      ${OPENBETA_AREA_SUMMARY_FIELDS}
      content {
        description
        areaLocation
      }
      aggregate {
        byDiscipline {
          trad { total }
          sport { total }
          bouldering { total }
          tr { total }
          ice { total }
          mixed { total }
          aid { total }
        }
        byGrade {
          label
          count
        }
      }
      children {
        ${OPENBETA_AREA_SUMMARY_FIELDS}
      }
      climbs {
        ${OPENBETA_CLIMB_FIELDS}
      }
    }
  }
`;

const OPENBETA_BULK_AREAS_QUERY = `
  query BulkAreas($ancestors: [String!]!, $limit: Int!) {
    bulkAreas(ancestors: $ancestors, limit: $limit) {
      ${OPENBETA_AREA_SUMMARY_FIELDS}
      climbs {
        ${OPENBETA_CLIMB_FIELDS}
      }
    }
  }
`;

const EMPTY_DB = {
  users: [],
  sessions: [],
  climbs: [],
  projects: [],
  media: [],
  shareCards: [],
  routeReferences: []
};

app.use(cors());
app.use(express.json({ limit: "10mb" }));

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nowIso() {
  return new Date().toISOString();
}

async function ensureDb() {
  await fs.mkdir(DB_DIR, { recursive: true });

  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify(EMPTY_DB, null, 2), "utf8");
  }
}

async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(DB_PATH, "utf8");
  return JSON.parse(raw);
}

async function writeDb(data) {
  await ensureDb();
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf8");
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    gradePreference: user.gradePreference,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}

function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization;
  const token = authorization && authorization.startsWith("Bearer ") ? authorization.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

function filterByUser(items, userId) {
  return items.filter((item) => item.userId === userId);
}

function findById(items, id) {
  return items.find((item) => item.id === id);
}

function normalizeProjectTitle(title) {
  return typeof title === "string" ? title.trim().toLowerCase() : "";
}

function normalizeProjectIdentityValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hasDuplicateProjectIdentity(projects, candidate, userId, excludeId) {
  const title = normalizeProjectIdentityValue(candidate.title);
  const locationName = normalizeProjectIdentityValue(candidate.locationName);
  const gradeLabel = normalizeProjectIdentityValue(candidate.gradeLabel);

  return projects.some(
    (project) =>
      project.userId === userId &&
      project.id !== excludeId &&
      normalizeProjectIdentityValue(project.title) === title &&
      normalizeProjectIdentityValue(project.locationName) === locationName &&
      normalizeProjectIdentityValue(project.gradeLabel) === gradeLabel
  );
}

function clampRating(value, fallback = 3) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(5, Math.max(1, Math.round(numeric)));
}

function sanitizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item).trim()).filter(Boolean);
}

function sanitizeOptionalString(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}

function buildMediaCaption(gradeLabel, outcome) {
  const outcomeLabelMap = {
    sent: "已完成",
    not_sent: "已放弃",
    in_progress: "尝试中"
  };

  return `${gradeLabel} · ${outcomeLabelMap[outcome] || outcome}`;
}

function compareSessionsByRecentActivity(left, right) {
  const updatedCompare = String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || ""));

  if (updatedCompare !== 0) {
    return updatedCompare;
  }

  const dateCompare = String(right.date || "").localeCompare(String(left.date || ""));

  if (dateCompare !== 0) {
    return dateCompare;
  }

  return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
}

function throwHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

async function openBetaGraphqlRequest(query, variables = {}) {
  const response = await fetch(OPENBETA_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throwHttpError(response.status, "OpenBeta request failed.");
  }

  const payload = await response.json();

  if (payload.errors?.length) {
    throwHttpError(502, payload.errors[0]?.message || "OpenBeta GraphQL error.");
  }

  return payload.data;
}

function normalizeOpenBetaLimit(value, fallback = 20, max = 50) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }

  return Math.min(max, Math.round(numeric));
}

function getPositiveClimbChildren(area) {
  return (Array.isArray(area?.children) ? area.children : [])
    .filter((child) => Number(child.totalClimbs || 0) > 0 && Array.isArray(child.ancestors) && child.ancestors.length === 2)
    .sort((left, right) => String(left.area_name || "").localeCompare(String(right.area_name || "")));
}

async function getOpenBetaAreaDetail(uuid) {
  const data = await openBetaGraphqlRequest(OPENBETA_AREA_DETAIL_QUERY, { uuid });
  return data.area;
}

async function getOpenBetaDownloadableRegionGroups() {
  if (
    openBetaDownloadableRegionsCache.loadedAt > 0 &&
    Date.now() - openBetaDownloadableRegionsCache.loadedAt < OPENBETA_DOWNLOADABLE_REGIONS_CACHE_MS
  ) {
    return openBetaDownloadableRegionsCache.groups;
  }

  const data = await openBetaGraphqlRequest(OPENBETA_COUNTRIES_QUERY);
  const countries = (data.countries || [])
    .filter((country) => Number(country.totalClimbs || 0) > 0)
    .sort((left, right) => String(left.area_name || "").localeCompare(String(right.area_name || "")));

  const groups = (
    await Promise.all(
      countries.map(async (country) => {
        try {
          const area = await getOpenBetaAreaDetail(country.uuid);
          const children = getPositiveClimbChildren(area);

          return children.length
            ? {
                country,
                areas: children
              }
            : undefined;
        } catch {
          return undefined;
        }
      })
    )
  ).filter(Boolean);

  openBetaDownloadableRegionsCache = {
    loadedAt: Date.now(),
    groups
  };

  return groups;
}

function normalizeComparableText(value) {
  return sanitizeOptionalString(value)?.toLowerCase() || "";
}

function buildProjectMaps(projects) {
  const sortedProjects = [...projects].sort((left, right) =>
    String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || ""))
  );

  return {
    projectById: new Map(sortedProjects.map((project) => [project.id, project])),
    projectIdByTitle: new Map(
      sortedProjects
        .map((project) => [normalizeProjectTitle(project.title), project.id])
        .filter(([title]) => title)
    )
  };
}

function getProjectCompatibilityError(project, draft, sessionLocationName) {
  const projectRouteReferenceId = normalizeComparableText(project.routeReferenceId);
  const draftRouteReferenceId = normalizeComparableText(draft.routeReferenceId);

  if (projectRouteReferenceId && draftRouteReferenceId && projectRouteReferenceId !== draftRouteReferenceId) {
    return `Project「${project.title}」绑定的是另一条线路，请不要混到同一个 Project 里。`;
  }

  const projectLocationName = normalizeComparableText(project.locationName);
  const nextLocationName = normalizeComparableText(sessionLocationName);

  if (projectLocationName && nextLocationName && projectLocationName !== nextLocationName) {
    return `Project「${project.title}」的地点是「${project.locationName}」，这次 Session 的地点不一致。`;
  }

  const projectGradeLabel = normalizeComparableText(project.gradeLabel);
  const nextGradeLabel = normalizeComparableText(draft.gradeLabel);

  if (projectGradeLabel && nextGradeLabel && projectGradeLabel !== nextGradeLabel) {
    return `Project「${project.title}」记录的是 ${project.gradeLabel}，这条 Climb 填的是 ${draft.gradeLabel}。`;
  }

  return undefined;
}

function syncProjectStateFromClimbs(db, userId, projectIds, timestamp) {
  const sessionById = new Map(filterByUser(db.sessions, userId).map((session) => [session.id, session]));

  projectIds.forEach((projectId) => {
    const project = findById(db.projects, projectId);

    if (!project || project.userId !== userId) {
      return;
    }

    const relatedClimbs = filterByUser(db.climbs, userId).filter((climb) => climb.projectId === projectId);

    if (!relatedClimbs.length) {
      project.firstAttemptDate = undefined;
      project.lastAttemptDate = undefined;
      project.updatedAt = timestamp;
      return;
    }

    const relatedSessions = relatedClimbs
      .map((climb) => sessionById.get(climb.sessionId))
      .filter(Boolean);
    const sessionDates = relatedSessions
      .map((session) => session.date)
      .filter(Boolean)
      .sort();

    if (sessionDates.length) {
      project.firstAttemptDate = sessionDates[0];
      project.lastAttemptDate = sessionDates[sessionDates.length - 1];
    }

    const sentDates = relatedClimbs
      .filter((climb) => climb.outcome === "sent")
      .map((climb) => sessionById.get(climb.sessionId)?.date)
      .filter(Boolean)
      .sort();

    if (sentDates.length) {
      project.status = "sent";
      project.sentDate = sentDates[sentDates.length - 1];
    }

    project.updatedAt = timestamp;
  });
}

function buildSessionRecord(userId, sessionInput, timestamp, existingSession) {
  return {
    id: existingSession?.id || createId("session"),
    userId,
    date: String(sessionInput.date || "").trim(),
    locationName: sanitizeOptionalString(sessionInput.locationName),
    discipline: sessionInput.discipline,
    disciplineOtherText: sessionInput.discipline === "other" ? sanitizeOptionalString(sessionInput.disciplineOtherText) : undefined,
    durationMinutes: Number.isInteger(sessionInput.durationMinutes) && sessionInput.durationMinutes > 0 ? sessionInput.durationMinutes : undefined,
    energyRating: clampRating(sessionInput.energyRating, 3),
    fatigueRating: clampRating(sessionInput.fatigueRating, 3),
    moodRating: clampRating(sessionInput.moodRating, 3),
    summary: sanitizeOptionalString(sessionInput.summary),
    createdAt: existingSession?.createdAt || timestamp,
    updatedAt: timestamp
  };
}

function saveClimbsAndMediaForSession({
  db,
  userId,
  session,
  climbInputs,
  projectById,
  projectIdByTitle,
  touchedProjectIds,
  timestamp
}) {
  const savedClimbs = [];
  const savedMedia = [];

  for (const draft of climbInputs) {
    let projectId;
    const nextProjectTitle = sanitizeOptionalString(draft.newProjectTitle);
    const projectFromSelection = draft.selectedProjectId ? projectById.get(draft.selectedProjectId) : undefined;
    const projectFromTitle = nextProjectTitle
      ? [...projectById.values()].find(
          (project) =>
            normalizeProjectIdentityValue(project.title) === normalizeProjectIdentityValue(nextProjectTitle) &&
            normalizeProjectIdentityValue(project.locationName) === normalizeProjectIdentityValue(session.locationName) &&
            normalizeProjectIdentityValue(project.gradeLabel) === normalizeProjectIdentityValue(String(draft.gradeLabel || ""))
        )
      : undefined;
    const targetProject = draft.addToProject ? projectFromSelection || projectFromTitle : undefined;

    if (draft.addToProject && targetProject) {
      const compatibilityError = getProjectCompatibilityError(targetProject, draft, session.locationName);

      if (compatibilityError) {
        throwHttpError(400, compatibilityError);
      }

      targetProject.firstAttemptDate = targetProject.firstAttemptDate || session.date;
      targetProject.lastAttemptDate = session.date;
      targetProject.updatedAt = timestamp;
      projectId = targetProject.id;
    } else if (draft.addToProject && nextProjectTitle) {
      const createdProject = {
        id: createId("project"),
        userId,
        title: nextProjectTitle,
        locationName: session.locationName,
        routeReferenceId: sanitizeOptionalString(draft.routeReferenceId),
        gradeLabel: String(draft.gradeLabel || "").trim(),
        gradeSystem: draft.gradeSystem,
        normalizedGradeValue: draft.normalizedGradeValue,
        status: draft.outcome === "sent" ? "sent" : "active",
        tags: sanitizeStringArray(draft.tags),
        betaNotes: sanitizeOptionalString(draft.betaNotes),
        firstAttemptDate: session.date,
        lastAttemptDate: session.date,
        sentDate: draft.outcome === "sent" ? session.date : undefined,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      if (hasDuplicateProjectIdentity(db.projects, createdProject, userId, createdProject.id)) {
        throwHttpError(400, "已经有同名、同地点、同难度的 Project。为了列表里更好区分，请换一个名字。");
      }

      db.projects.push(createdProject);
      projectById.set(createdProject.id, createdProject);
      projectIdByTitle.set(normalizeProjectTitle(createdProject.title), createdProject.id);
      projectId = createdProject.id;
    }

    if (projectId) {
      touchedProjectIds.add(projectId);
    }

    const climbId = createId("climb");
    const mediaItems = Array.isArray(draft.mediaItems) ? draft.mediaItems : [];
    const mediaIds = [];

    for (const item of mediaItems) {
      const media = {
        id: createId("media"),
        userId,
        type: item.type === "video" ? "video" : "image",
        uri: String(item.uri || "").trim(),
        thumbnailUri: sanitizeOptionalString(item.thumbnailUri),
        sessionId: session.id,
        climbId,
        projectId,
        caption: buildMediaCaption(String(draft.gradeLabel || "").trim(), draft.outcome),
        createdAt: timestamp
      };

      db.media.push(media);
      mediaIds.push(media.id);
      savedMedia.push(media);
    }

    const climb = {
      id: climbId,
      userId,
      sessionId: session.id,
      projectId,
      routeReferenceId: sanitizeOptionalString(draft.routeReferenceId),
      source: "user_created",
      gradeLabel: String(draft.gradeLabel || "").trim(),
      gradeSystem: draft.gradeSystem,
      normalizedGradeValue: draft.normalizedGradeValue,
      outcome: draft.outcome,
      ascentStyle: draft.ascentStyle,
      betaKnowledge: draft.betaKnowledge,
      attemptOutcome: draft.attemptOutcome,
      attemptsBucket: draft.attemptsBucket,
      attemptsCount: Number.isInteger(draft.attemptsCount) && draft.attemptsCount > 0 ? draft.attemptsCount : undefined,
      fallsCount: Number.isInteger(draft.fallsCount) && draft.fallsCount >= 0 ? draft.fallsCount : undefined,
      takesCount: Number.isInteger(draft.takesCount) && draft.takesCount >= 0 ? draft.takesCount : undefined,
      highPoint: sanitizeOptionalString(draft.highPoint),
      fearRating: clampRating(draft.fearRating, 3),
      tags: sanitizeStringArray(draft.tags),
      failureReasons: sanitizeStringArray(draft.failureReasons),
      betaNotes: sanitizeOptionalString(draft.betaNotes),
      notes: sanitizeOptionalString(draft.notes),
      mediaIds,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    db.climbs.push(climb);
    savedClimbs.push(climb);
  }

  return { savedClimbs, savedMedia };
}

async function persistCompleteSession(db, userId, sessionInput, climbInputs, existingSessionId) {
  const timestamp = nowIso();
  const touchedProjectIds = new Set();
  const existingSession = existingSessionId ? db.sessions.find((session) => session.id === existingSessionId && session.userId === userId) : undefined;

  if (existingSessionId && !existingSession) {
    throwHttpError(404, "Session not found.");
  }

  const previousProjectIds = existingSessionId
    ? filterByUser(db.climbs, userId)
        .filter((climb) => climb.sessionId === existingSessionId && climb.projectId)
        .map((climb) => climb.projectId)
    : [];

  previousProjectIds.forEach((projectId) => touchedProjectIds.add(projectId));

  const session = buildSessionRecord(userId, sessionInput, timestamp, existingSession);

  if (existingSession) {
    const sessionIndex = db.sessions.findIndex((item) => item.id === existingSession.id && item.userId === userId);
    db.sessions[sessionIndex] = session;
    db.climbs = db.climbs.filter((climb) => !(climb.userId === userId && climb.sessionId === existingSession.id));
    db.media = db.media.filter((media) => !(media.userId === userId && media.sessionId === existingSession.id));
  } else {
    db.sessions.push(session);
  }

  const { projectById, projectIdByTitle } = buildProjectMaps(filterByUser(db.projects, userId));
  const { savedClimbs, savedMedia } = saveClimbsAndMediaForSession({
    db,
    userId,
    session,
    climbInputs,
    projectById,
    projectIdByTitle,
    touchedProjectIds,
    timestamp
  });

  syncProjectStateFromClimbs(db, userId, touchedProjectIds, timestamp);
  await writeDb(db);

  return {
    session,
    climbs: savedClimbs,
    media: savedMedia,
    projects: [...touchedProjectIds].map((projectId) => projectById.get(projectId)).filter(Boolean)
  };
}

async function getCurrentUser(req) {
  const db = await readDb();
  const user = db.users.find((item) => item.id === req.auth.sub);
  return { db, user };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, timestamp: nowIso() });
});

app.post("/api/auth/register", async (req, res) => {
  const { email, password, nickname } = req.body || {};

  if (!email || !password) {
    res.status(400).json({ message: "Email and password are required." });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    res.status(400).json({ message: "Email format is invalid." });
    return;
  }

  if (String(password).length < 6) {
    res.status(400).json({ message: "Password must be at least 6 characters." });
    return;
  }

  const db = await readDb();

  if (db.users.some((item) => item.email === normalizedEmail)) {
    res.status(409).json({ message: "This email is already registered." });
    return;
  }

  const now = nowIso();
  const user = {
    id: createId("user"),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(String(password), 10),
    nickname: String(nickname || normalizedEmail.split("@")[0]).trim(),
    gradePreference: "v_scale",
    createdAt: now,
    updatedAt: now
  };

  db.users.push(user);
  await writeDb(db);

  res.status(201).json({
    token: issueToken(user),
    user: sanitizeUser(user)
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const db = await readDb();
  const user = db.users.find((item) => item.email === normalizedEmail);

  if (!user || !(await bcrypt.compare(String(password || ""), user.passwordHash))) {
    res.status(401).json({ message: "Email or password is incorrect." });
    return;
  }

  res.json({
    token: issueToken(user),
    user: sanitizeUser(user)
  });
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  const { user } = await getCurrentUser(req);

  if (!user) {
    res.status(401).json({ message: "User not found." });
    return;
  }

  res.json({ user: sanitizeUser(user) });
});

app.get("/api/openbeta/areas/search", authMiddleware, async (req, res) => {
  const query = String(req.query.q || "").trim();

  if (query.length < 2) {
    res.status(400).json({ message: "Search query must be at least 2 characters." });
    return;
  }

  try {
    const data = await openBetaGraphqlRequest(OPENBETA_AREA_SEARCH_QUERY, {
      query,
      limit: normalizeOpenBetaLimit(req.query.limit, 20, 40)
    });
    res.json({ areas: data.areas || [] });
  } catch (error) {
    res.status(error.statusCode || 502).json({ message: error.message || "OpenBeta request failed." });
  }
});

app.get("/api/openbeta/countries", authMiddleware, async (_req, res) => {
  try {
    const data = await openBetaGraphqlRequest(OPENBETA_COUNTRIES_QUERY);
    res.json({ areas: data.countries || [] });
  } catch (error) {
    res.status(error.statusCode || 502).json({ message: error.message || "OpenBeta request failed." });
  }
});

app.get("/api/openbeta/downloadable-regions", authMiddleware, async (_req, res) => {
  try {
    const groups = await getOpenBetaDownloadableRegionGroups();
    res.json({ groups });
  } catch (error) {
    res.status(error.statusCode || 502).json({ message: error.message || "OpenBeta request failed." });
  }
});

app.get("/api/openbeta/areas/:uuid/children", authMiddleware, async (req, res) => {
  try {
    const area = await getOpenBetaAreaDetail(req.params.uuid);

    if (!area) {
      res.status(404).json({ message: "OpenBeta area not found." });
      return;
    }

    res.json({
      area,
      areas: getPositiveClimbChildren(area)
    });
  } catch (error) {
    res.status(error.statusCode || 502).json({ message: error.message || "OpenBeta request failed." });
  }
});

app.get("/api/openbeta/areas/:uuid/download", authMiddleware, async (req, res) => {
  try {
    const area = await getOpenBetaAreaDetail(req.params.uuid);

    if (!area) {
      res.status(404).json({ message: "OpenBeta area not found." });
      return;
    }

    const downloadLimit = normalizeOpenBetaLimit(req.query.limit, OPENBETA_DOWNLOAD_LIMIT, 300);
    const ancestors = Array.isArray(area.ancestors) && area.ancestors.length ? area.ancestors : [area.uuid];
    let downloadedAreas = [];

    if (ancestors.length !== 2) {
      res.status(400).json({ message: "请选择国家下面第一层州/省/区域下载，不支持下载整个国家或更深层子区域。" });
      return;
    }

    const bulkData = await openBetaGraphqlRequest(OPENBETA_BULK_AREAS_QUERY, {
      ancestors,
      limit: downloadLimit
    });
    downloadedAreas = (bulkData.bulkAreas || []).filter((item) => Number(item.totalClimbs || 0) > 0 || item.uuid === area.uuid);

    res.json({
      area,
      areas: downloadedAreas,
      fetchedAt: nowIso(),
      downloadLimit,
      source: "openbeta"
    });
  } catch (error) {
    res.status(error.statusCode || 502).json({ message: error.message || "OpenBeta request failed." });
  }
});

app.get("/api/bootstrap", authMiddleware, async (req, res) => {
  const userId = req.auth.sub;
  const db = await readDb();

  res.json({
    sessions: filterByUser(db.sessions, userId).sort(compareSessionsByRecentActivity),
    climbs: filterByUser(db.climbs, userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    projects: filterByUser(db.projects, userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    media: filterByUser(db.media, userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    shareCards: filterByUser(db.shareCards, userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    routeReferences: filterByUser(db.routeReferences, userId)
  });
});

app.post("/api/complete-session", authMiddleware, async (req, res) => {
  const { session: sessionInput, climbs: climbInputs } = req.body || {};

  if (!sessionInput || !Array.isArray(climbInputs) || !climbInputs.length) {
    res.status(400).json({ message: "Session 和 climbs 为必填项。" });
    return;
  }

  if (climbInputs.length > 1) {
    res.status(400).json({ message: "每条 Session 只能提交 1 条 Climb。" });
    return;
  }

  try {
    const db = await readDb();
    const result = await persistCompleteSession(db, req.auth.sub, sessionInput, climbInputs);
    res.status(201).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || "Internal server error" });
  }
});

app.patch("/api/complete-session/:sessionId", authMiddleware, async (req, res) => {
  const { session: sessionInput, climbs: climbInputs } = req.body || {};

  if (!sessionInput || !Array.isArray(climbInputs) || !climbInputs.length) {
    res.status(400).json({ message: "Session 和 climbs 为必填项。" });
    return;
  }

  if (climbInputs.length > 1) {
    res.status(400).json({ message: "每条 Session 只能提交 1 条 Climb。" });
    return;
  }

  try {
    const db = await readDb();
    const result = await persistCompleteSession(db, req.auth.sub, sessionInput, climbInputs, req.params.sessionId);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || "Internal server error" });
  }
});

function registerCollectionRoutes(collectionKey) {
  app.get(`/api/${collectionKey}`, authMiddleware, async (req, res) => {
    const db = await readDb();
    res.json(filterByUser(db[collectionKey], req.auth.sub));
  });

  app.post(`/api/${collectionKey}`, authMiddleware, async (req, res) => {
    const db = await readDb();
    const entity = req.body || {};

    if (entity.userId && entity.userId !== req.auth.sub) {
      res.status(403).json({ message: "Cannot write another user's data." });
      return;
    }

    const created = {
      ...entity,
      userId: req.auth.sub
    };

    if (collectionKey === "projects" && hasDuplicateProjectIdentity(db.projects, created, req.auth.sub, created.id)) {
      res.status(400).json({ message: "已经有同名、同地点、同难度的 Project。为了列表里更好区分，请换一个名字。" });
      return;
    }

    db[collectionKey].push(created);
    await writeDb(db);
    res.status(201).json(created);
  });

  app.patch(`/api/${collectionKey}/:id`, authMiddleware, async (req, res) => {
    const db = await readDb();
    const index = db[collectionKey].findIndex((item) => item.id === req.params.id && item.userId === req.auth.sub);

    if (index === -1) {
      res.status(404).json({ message: "Record not found." });
      return;
    }

    const updated = {
      ...db[collectionKey][index],
      ...req.body,
      userId: req.auth.sub
    };

    if (collectionKey === "projects" && hasDuplicateProjectIdentity(db.projects, updated, req.auth.sub, updated.id)) {
      res.status(400).json({ message: "已经有同名、同地点、同难度的 Project。为了列表里更好区分，请换一个名字。" });
      return;
    }

    db[collectionKey][index] = updated;

    await writeDb(db);
    res.json(db[collectionKey][index]);
  });
}

["sessions", "climbs", "projects", "media", "shareCards", "routeReferences"].forEach(registerCollectionRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
    res.status(500).json({ message: "Internal server error" });
});

ensureDb()
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`Climbing Grit Journal API listening on http://${HOST}:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });
