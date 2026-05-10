import Taro from "@tarojs/taro";

const memoryStore = new Map<string, string>();

function hasTaroStorage() {
  return typeof Taro?.getStorageSync === "function" && typeof Taro?.setStorageSync === "function";
}

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = hasTaroStorage() ? Taro.getStorageSync(key) : memoryStore.get(key);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw as string) as T;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T) {
  const raw = JSON.stringify(value);

  if (hasTaroStorage()) {
    Taro.setStorageSync(key, raw);
    return;
  }

  memoryStore.set(key, raw);
}

export function removeStorage(key: string) {
  if (hasTaroStorage()) {
    Taro.removeStorageSync(key);
    return;
  }

  memoryStore.delete(key);
}
