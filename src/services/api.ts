import Taro from "@tarojs/taro";
import { API_BASE_URL } from "@/constants/api";
import { getAuthToken, clearAuthSession } from "./auth-session";

export const REQUEST_ABORTED_ERROR = "REQUEST_ABORTED";
export const LOCAL_API_UNAVAILABLE_ERROR = "LOCAL_API_UNAVAILABLE";

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
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

    if (response.statusCode === 401 && !options.skipAuth) {
      clearAuthSession();
      throw new Error("AUTH_REQUIRED");
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      const message =
        typeof response.data === "object" && response.data && "message" in response.data
          ? String((response.data as { message: unknown }).message)
          : typeof response.data === "string" && response.data.trim()
            ? response.data.trim()
          : "Request failed";
      throw new Error(message);
    }

    return response.data;
  } catch (error) {
    const requestErrorMessage =
      error &&
      typeof error === "object" &&
      "errMsg" in error &&
      typeof error.errMsg === "string"
        ? error.errMsg
        : undefined;

    if (
      requestErrorMessage?.toLowerCase().includes("abort")
    ) {
      throw new Error(REQUEST_ABORTED_ERROR);
    }

    if (
      requestErrorMessage &&
      /(connection refused|failed to connect|econnrefused)/i.test(requestErrorMessage)
    ) {
      throw new Error(LOCAL_API_UNAVAILABLE_ERROR);
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn("[apiRequest failed]", url, error);
    }

    if (requestErrorMessage) {
      const htmlTitle = /<title>(.*?)<\/title>/i.exec(requestErrorMessage)?.[1];
      const preMessage = /<pre>([\s\S]*?)<\/pre>/i.exec(requestErrorMessage)?.[1];
      throw new Error(preMessage || htmlTitle || requestErrorMessage);
    }

    throw error;
  } finally {
    activeRequests.delete(requestTask as AbortableRequestTask<unknown>);
  }
}
