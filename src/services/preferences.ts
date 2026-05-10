import { readStorage, writeStorage } from "./storage";

export type AppLanguage = "zh-CN" | "en";

const LANGUAGE_STORAGE_KEY = "cgj.preferences.language";

export const LANGUAGE_OPTIONS: Array<{ label: string; value: AppLanguage }> = [
  { label: "中文", value: "zh-CN" },
  { label: "English", value: "en" }
];

export function getLanguagePreference() {
  return readStorage<AppLanguage>(LANGUAGE_STORAGE_KEY, "zh-CN");
}

export function saveLanguagePreference(language: AppLanguage) {
  writeStorage(LANGUAGE_STORAGE_KEY, language);
}
