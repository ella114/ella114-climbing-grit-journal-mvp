import Taro, { useDidShow } from "@tarojs/taro";
import { useEffect } from "react";
import { useAuth } from "@/store/auth";

export function useProtectedPage() {
  const auth = useAuth();

  function guard() {
    if (!auth.isLoading && !auth.isAuthenticated) {
      Taro.reLaunch({ url: "/pages/login/index" });
    }
  }

  useEffect(guard, [auth.isAuthenticated, auth.isLoading]);
  useDidShow(guard);

  return auth;
}
