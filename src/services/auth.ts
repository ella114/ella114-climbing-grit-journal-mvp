import { AuthResponse, AuthUser } from "@/types/auth";
import { apiRequest } from "./api";
import { getAuthToken, storeAuthSession } from "./auth-session";

export async function login(email: string, password: string) {
  const result = await apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    data: { email, password },
    skipAuth: true
  });
  storeAuthSession(result);
  return result;
}

export async function register(email: string, password: string, nickname: string) {
  const result = await apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    data: { email, password, nickname },
    skipAuth: true
  });
  storeAuthSession(result);
  return result;
}

export async function fetchMe() {
  const result = await apiRequest<{ user: AuthUser }>("/auth/me");
  storeAuthSession({
    token: getAuthToken() || "",
    user: result.user
  });
  return result.user;
}
