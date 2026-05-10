import Taro, { useDidShow } from "@tarojs/taro";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBootstrapData } from "@/services/repositories";
import { LOCAL_API_UNAVAILABLE_ERROR, REQUEST_ABORTED_ERROR } from "@/services/api";
import { Climb, ClimbingSession, Media, Project, RouteReference, ShareCard } from "@/types/domain";

type BootstrapState = {
  sessions: ClimbingSession[];
  climbs: Climb[];
  projects: Project[];
  media: Media[];
  shareCards: ShareCard[];
  routeReferences: RouteReference[];
};

const EMPTY_STATE: BootstrapState = {
  sessions: [],
  climbs: [],
  projects: [],
  media: [],
  shareCards: [],
  routeReferences: []
};

const CACHE_WINDOW_MS = 1500;
let sharedBootstrapData: BootstrapState = EMPTY_STATE;
let sharedBootstrapLoadedAt = 0;
let sharedBootstrapRequest: Promise<BootstrapState> | null = null;

async function loadSharedBootstrapData() {
  if (!sharedBootstrapRequest) {
    sharedBootstrapRequest = getBootstrapData()
      .then((next) => {
        sharedBootstrapData = next;
        sharedBootstrapLoadedAt = Date.now();
        return next;
      })
      .finally(() => {
        sharedBootstrapRequest = null;
      });
  }

  return sharedBootstrapRequest;
}

export function useBootstrapData(enabled: boolean) {
  const [data, setData] = useState<BootstrapState>(() => (enabled ? sharedBootstrapData : EMPTY_STATE));
  const [isLoading, setIsLoading] = useState(() => enabled && !sharedBootstrapLoadedAt);
  const skipNextDidShowRef = useRef(true);

  const reload = useCallback(
    async (options?: { preferCache?: boolean }) => {
      if (!enabled) {
        setData(EMPTY_STATE);
        setIsLoading(false);
        return;
      }

      const shouldUseCache =
        Boolean(options?.preferCache) && sharedBootstrapLoadedAt > 0 && Date.now() - sharedBootstrapLoadedAt < CACHE_WINDOW_MS;

      if (shouldUseCache) {
        setData(sharedBootstrapData);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const next = await loadSharedBootstrapData();
        setData(next);
      } catch (error) {
        if (error instanceof Error && error.message === REQUEST_ABORTED_ERROR) {
          return;
        }

        if (error instanceof Error && error.message === "AUTH_REQUIRED") {
          Taro.reLaunch({ url: "/pages/login/index" });
          return;
        }

        if (error instanceof Error && error.message === LOCAL_API_UNAVAILABLE_ERROR) {
          Taro.showToast({ title: "本地 API 未启动", icon: "none" });
          return;
        }

        Taro.showToast({ title: error instanceof Error ? error.message : "加载数据失败", icon: "none" });
      } finally {
        setIsLoading(false);
      }
    },
    [enabled]
  );

  useEffect(() => {
    skipNextDidShowRef.current = true;
    void reload({ preferCache: true });
  }, [reload]);

  useDidShow(() => {
    if (skipNextDidShowRef.current) {
      skipNextDidShowRef.current = false;
      return;
    }

    void reload();
  });

  return {
    ...data,
    isLoading,
    reload,
    setData
  };
}
