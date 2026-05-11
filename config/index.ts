import { defineConfig } from "@tarojs/cli";
import path from "node:path";
import devConfig from "./dev";
import prodConfig from "./prod";

export default defineConfig(async (merge, { command, mode }) => {
  const defaultLocalApiBaseUrl = "http://127.0.0.1:4000/api";
  const configuredApiBaseUrl = process.env.TARO_APP_API_BASE_URL?.trim();
  const apiBaseUrl = configuredApiBaseUrl
    ? configuredApiBaseUrl.endsWith("/")
      ? configuredApiBaseUrl.slice(0, -1)
      : configuredApiBaseUrl
    : defaultLocalApiBaseUrl;

  const baseConfig = {
    projectName: "climbing-grit-journal-mvp",
    date: "2026-05-06",
    designWidth: 375,
    sourceRoot: "src",
    outputRoot: "dist",
    alias: {
      "@": path.resolve(__dirname, "..", "src")
    },
    framework: "react",
    compiler: {
      type: "webpack5",
      prebundle: {
        enable: false,
        cacheDir: path.resolve(__dirname, "..", ".taro-cache")
      }
    },
    defineConstants: {
      __API_BASE_URL__: JSON.stringify(apiBaseUrl)
    },
    mini: {},
    h5: {}
  };

  if (command === "build") {
    return merge({}, baseConfig, mode === "production" ? prodConfig : devConfig);
  }

  return merge({}, baseConfig, devConfig);
});
