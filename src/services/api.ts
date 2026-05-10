import Taro from "@tarojs/taro";
import { API_BASE_URL } from "@/constants/api";
import { getAuthToken, clearAuthSession } from "./auth-session";

export const REQUEST_ABORTED_ERROR = "REQUEST_ABORTED";
export const LOCAL_API_UNAVAILABLE_ERROR = "LOCAL_API_UNAVAILABLE";

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH";
  data?: unknown;
  skipAuth?: boolean;
};

type AbortableRequestTask<T> = Promise<{
  data: T;
  statusCode: number;
}> & {
  abort?: () => void;
};

const activeRequests = new Set<AbortableRequestTask<unknown>>();

export function cancelActiveApiRequests() {
  activeRequests.forEach((requestTask) => {
    requestTask.abort?.();
  });
  activeRequests.clear();
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}) {
  const token = options.skipAuth ? undefined : getAuthToken();
  const url = `${API_BASE_URL}${path}`;
  const requestTask = Taro.request<T>({
    url,
    method: options.method ?? "GET",
    data: options.data,
    header: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  }) as AbortableRequestTask<T>;

  activeRequests.add(requestTask as AbortableRequestTask<unknown>);

  try {
    const response = await requestTask;

    if (response.statusCode === 401) {
      clearAuthSession();
      throw new Error("AUTH_REQUIRED");
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      const message =
        typeof response.data === "object" && response.data && "message" in response.data
          ? String((response.data as { message: unknown }).message)
          : "Request failed";
      throw new Error(message);
    }

    return response.data;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "errMsg" in error &&
      typeof error.errMsg === "string" &&
      error.errMsg.toLowerCase().includes("abort")
    ) {
      throw new Error(REQUEST_ABORTED_ERROR);
    }

    if (
      error &&
      typeof error === "object" &&
      "errMsg" in error &&
      typeof error.errMsg === "string" &&
      /(connection refused|failed to connect|econnrefused)/i.test(error.errMsg)
    ) {
      throw new Error(LOCAL_API_UNAVAILABLE_ERROR);
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn("[apiRequest failed]", url, error);
    }

    throw error;
  } finally {
    activeRequests.delete(requestTask as AbortableRequestTask<unknown>);
  }
}
