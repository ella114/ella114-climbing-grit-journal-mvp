const DEFAULT_LOCAL_API_BASE_URL = "http://127.0.0.1:4000/api";

declare const __API_BASE_URL__: string;

function normalizeApiBaseUrl(url?: string) {
  const trimmed = url?.trim();

  if (!trimmed) {
    return DEFAULT_LOCAL_API_BASE_URL;
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export const API_BASE_URL = normalizeApiBaseUrl(typeof __API_BASE_URL__ === "string" ? __API_BASE_URL__ : undefined);
export const API_BASE_URL_IS_LOCAL = /^(http:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(API_BASE_URL);
