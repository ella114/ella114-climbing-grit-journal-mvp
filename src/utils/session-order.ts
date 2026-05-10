import { ClimbingSession } from "@/types/domain";

export function compareSessionsByRecentActivity(left: ClimbingSession, right: ClimbingSession) {
  const updatedCompare = (right.updatedAt || right.createdAt || "").localeCompare(left.updatedAt || left.createdAt || "");

  if (updatedCompare !== 0) {
    return updatedCompare;
  }

  const dateCompare = (right.date || "").localeCompare(left.date || "");

  if (dateCompare !== 0) {
    return dateCompare;
  }

  return (right.createdAt || "").localeCompare(left.createdAt || "");
}

export function getSessionActivityTimestamp(session: ClimbingSession) {
  return session.updatedAt || session.createdAt || "";
}

export function formatSessionActivityTime(session: ClimbingSession) {
  const timestamp = getSessionActivityTimestamp(session);

  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}
