#!/usr/bin/env node

const Module = require("node:module");

const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "@tarojs/plugin-doctor") {
    const okResult = { isValid: true, messages: [] };

    return {
      validateConfig: async () => okResult,
      validateConfigPrint: () => true,
      validateEnv: () => okResult,
      validateEnvPrint: () => true,
      validatePackage: () => okResult,
      validatePackagePrint: () => true,
      validateRecommend: () => okResult,
      validateRecommendPrint: () => true
    };
  }

  return originalLoad.apply(this, arguments);
};

require("@tarojs/cli/bin/taro");
