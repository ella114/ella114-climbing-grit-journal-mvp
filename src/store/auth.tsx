import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from "react";
import { AuthUser } from "@/types/auth";
import { fetchMe, login, register } from "@/services/auth";
import { LOCAL_API_UNAVAILABLE_ERROR, REQUEST_ABORTED_ERROR } from "@/services/api";
import { clearAuthSession, getAuthToken, getStoredAuthUser } from "@/services/auth-session";

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  registerWithPassword: (email: string, password: string, nickname: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(getStoredAuthUser());
  const [isLoading, setIsLoading] = useState(true);

  async function refreshUser() {
    if (!getAuthToken()) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const nextUser = await fetchMe();
      setUser(nextUser);
    } catch (error) {
      if (error instanceof Error && error.message === REQUEST_ABORTED_ERROR) {
        return;
      }

      if (error instanceof Error && error.message === "AUTH_REQUIRED") {
        clearAuthSession();
        setUser(null);
      }

      if (error instanceof Error && error.message === LOCAL_API_UNAVAILABLE_ERROR) {
        return;
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshUser();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      async loginWithPassword(email: string, password: string) {
        const result = await login(email, password);
        setUser(result.user);
      },
      async registerWithPassword(email: string, password: string, nickname: string) {
        const result = await register(email, password, nickname);
        setUser(result.user);
      },
      logout() {
        clearAuthSession();
        setUser(null);
      },
      refreshUser
    }),
    [isLoading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
