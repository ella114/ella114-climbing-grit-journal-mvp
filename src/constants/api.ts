const DEFAULT_LOCAL_API_BASE_URL = "http://127.0.0.1:4000/api";

function normalizeApiBaseUrl(url?: string) {
  const trimmed = url?.trim();

  if (!trimmed) {
    return DEFAULT_LOCAL_API_BASE_URL;
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export const API_BASE_URL = normalizeApiBaseUrl(process.env.TARO_APP_API_BASE_URL);
export const API_BASE_URL_IS_LOCAL = /^(http:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(API_BASE_URL);
