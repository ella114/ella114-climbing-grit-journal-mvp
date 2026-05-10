import { defineConfig } from "@tarojs/cli";
import path from "node:path";
import devConfig from "./dev";
import prodConfig from "./prod";

export default defineConfig(async (merge, { command, mode }) => {
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
        enable: true,
        cacheDir: path.resolve(__dirname, "..", ".taro-cache")
      }
    },
    mini: {},
    h5: {}
  };

  if (command === "build") {
    return merge({}, baseConfig, mode === "production" ? prodConfig : devConfig);
  }

  return merge({}, baseConfig, devConfig);
});
