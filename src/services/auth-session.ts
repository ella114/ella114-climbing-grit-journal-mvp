import { AuthResponse, AuthUser } from "@/types/auth";
import { readStorage, writeStorage } from "./storage";

const AUTH_TOKEN_KEY = "cgj.auth.token";
const AUTH_USER_KEY = "cgj.auth.user";

export function getAuthToken() {
  return readStorage<string | null>(AUTH_TOKEN_KEY, null);
}

export function getStoredAuthUser() {
  return readStorage<AuthUser | null>(AUTH_USER_KEY, null);
}

export function storeAuthSession(payload: AuthResponse) {
  writeStorage(AUTH_TOKEN_KEY, payload.token);
  writeStorage(AUTH_USER_KEY, payload.user);
}

export function clearAuthSession() {
  writeStorage(AUTH_TOKEN_KEY, null);
  writeStorage(AUTH_USER_KEY, null);
}
