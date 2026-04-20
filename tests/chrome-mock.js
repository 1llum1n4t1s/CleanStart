"use strict";

/**
 * テスト用 chrome API モック。
 *
 * - `chrome.storage.local.{get,set}` を最小実装
 * - `chrome.runtime.lastError` を `setLastError(message)` で人為的に注入可能
 * - 非同期は `queueMicrotask` で擬似ディスパッチし、テスト側は `await` で同期可能
 */
function createChromeMock(initialStorage) {
  const storage = Object.assign({}, initialStorage || {});
  const state = { lastError: null };
  const calls = {
    get: [],
    set: []
  };

  const chrome = {
    storage: {
      local: {
        get(keys, cb) {
          calls.get.push(keys);
          const result = {};
          let keysToFetch;

          if (keys === null || typeof keys === "undefined") {
            keysToFetch = Object.keys(storage);
          } else if (Array.isArray(keys)) {
            keysToFetch = keys;
          } else if (typeof keys === "string") {
            keysToFetch = [keys];
          } else if (typeof keys === "object") {
            // get({key: defaultValue}) パターン
            keysToFetch = Object.keys(keys);
            for (const k of keysToFetch) {
              result[k] = keys[k];
            }
          } else {
            keysToFetch = [];
          }

          for (const key of keysToFetch) {
            if (key in storage) {
              result[key] = storage[key];
            }
          }

          queueMicrotask(() => cb(result));
        },
        set(payload, cb) {
          calls.set.push(Object.assign({}, payload));
          if (state.lastError) {
            // set は失敗しても storage を変更しない
            queueMicrotask(() => cb());
            return;
          }
          Object.assign(storage, payload);
          queueMicrotask(() => cb());
        }
      }
    },
    runtime: {
      get lastError() {
        return state.lastError;
      }
    }
  };

  return {
    chrome,
    storage,
    setLastError(message) {
      state.lastError = message ? { message } : null;
    },
    calls,
    reset() {
      for (const key of Object.keys(storage)) {
        delete storage[key];
      }
      state.lastError = null;
      calls.get.length = 0;
      calls.set.length = 0;
    }
  };
}

/**
 * テスト中の console.warn を捕捉して配列に貯める。テスト後 restore() で復元。
 */
function captureConsoleWarn() {
  const messages = [];
  const original = console.warn;
  console.warn = (...args) => {
    messages.push(args);
  };
  return {
    messages,
    restore() {
      console.warn = original;
    }
  };
}

/**
 * settings.js を「クリーンな状態」で再ロードして CleanStartSettings を返す。
 * 各テストごとに chrome を差し替えてから loadFreshSettings を呼ぶ。
 */
function loadFreshSettings(chromeStub) {
  // require キャッシュを無効化
  const settingsPath = require.resolve("../src/shared/settings.js");
  delete require.cache[settingsPath];
  // グローバルに chrome を注入
  global.chrome = chromeStub;
  return require("../src/shared/settings.js");
}

module.exports = {
  createChromeMock,
  captureConsoleWarn,
  loadFreshSettings
};
