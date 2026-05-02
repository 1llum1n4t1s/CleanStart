(function initializeCleanStartSettings(global) {
  // appcache (Chrome 93 で削除) と webSQL (Chrome 119 で削除) は browsingData
  // 側でも実体が無いため、UI に表示しても誤解を招くので除外している。
  const DATA_TYPES = Object.freeze([
    "cache",
    "cacheStorage",
    "cookies",
    "downloads",
    "fileSystems",
    "formData",
    "history",
    "indexedDB",
    "localStorage",
    "serviceWorkers"
  ]);

  // DATA_TYPES のうち、削除後にタブのリロードを必要とするもの。
  // downloads / formData / history はリロード不要。
  const STARTUP_RELOAD_DATA_TYPES = Object.freeze(new Set([
    "cache",
    "cacheStorage",
    "cookies",
    "fileSystems",
    "indexedDB",
    "localStorage",
    "serviceWorkers"
  ]));

  // DATA_TYPES の各キーに対応する i18n メッセージキー。
  const DATA_TYPE_MESSAGE_KEYS = Object.freeze({
    cache: "options_remove_cache",
    cacheStorage: "options_remove_cache_storage",
    cookies: "options_remove_cookies",
    downloads: "options_remove_downloads",
    fileSystems: "options_remove_fsys",
    formData: "options_remove_forms",
    history: "options_remove_history",
    indexedDB: "options_remove_db",
    localStorage: "options_remove_storage",
    serviceWorkers: "options_remove_service_workers"
  });

  const TIME_PERIODS = Object.freeze([
    "last_hour",
    "last_day",
    "last_week",
    "last_month",
    "everything"
  ]);

  // setFlag が受け付ける boolean フラグのキー。
  const SETTABLE_FLAGS = Object.freeze(new Set([
    "autorefresh",
    "clearonstartup"
  ]));

  const DEFAULT_RAW_SETTINGS = Object.freeze({
    autorefresh: false,
    clearonstartup: false,
    dataToRemove: JSON.stringify(["cache", "cacheStorage", "fileSystems", "indexedDB"]),
    timePeriod: "last_hour"
  });

  const STORAGE_KEYS = Object.freeze(Object.keys(DEFAULT_RAW_SETTINGS));

  function getStorage(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (items) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(items || {});
      });
    });
  }

  function setStorage(payload) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(payload, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  function safeParseJSON(rawValue, fallbackValue) {
    if (typeof rawValue !== "string") {
      return fallbackValue;
    }

    try {
      return JSON.parse(rawValue);
    } catch (_error) {
      return fallbackValue;
    }
  }

  function normalizeDataToRemove(rawValue) {
    const parsedValue = Array.isArray(rawValue)
      ? rawValue
      : safeParseJSON(rawValue, safeParseJSON(DEFAULT_RAW_SETTINGS.dataToRemove, []));

    return DATA_TYPES.filter((dataType) => parsedValue.includes(dataType));
  }

  function normalizeTimePeriod(rawValue) {
    return TIME_PERIODS.includes(rawValue)
      ? rawValue
      : DEFAULT_RAW_SETTINGS.timePeriod;
  }

  function normalizeSettings(rawValue) {
    const mergedValue = {
      ...DEFAULT_RAW_SETTINGS,
      ...(rawValue || {})
    };

    return {
      autorefresh: Boolean(mergedValue.autorefresh),
      clearonstartup: Boolean(mergedValue.clearonstartup),
      dataToRemove: normalizeDataToRemove(mergedValue.dataToRemove),
      timePeriod: normalizeTimePeriod(mergedValue.timePeriod)
    };
  }

  async function ensureDefaults() {
    const storedValue = await getStorage(STORAGE_KEYS);
    const missingValue = {};

    for (const key of STORAGE_KEYS) {
      if (typeof storedValue[key] === "undefined") {
        missingValue[key] = DEFAULT_RAW_SETTINGS[key];
      }
    }

    if (Object.keys(missingValue).length > 0) {
      await setStorage(missingValue);
    }

    return normalizeSettings({
      ...storedValue,
      ...missingValue
    });
  }

  async function load() {
    const storedValue = await getStorage(STORAGE_KEYS);
    return normalizeSettings(storedValue);
  }

  async function setFlag(name, value) {
    if (!SETTABLE_FLAGS.has(name)) {
      console.warn("Clean Start setFlag rejected unknown flag:", name);
      return;
    }
    await setStorage({ [name]: Boolean(value) });
  }

  async function setDataToRemove(value) {
    await setStorage({
      dataToRemove: JSON.stringify(normalizeDataToRemove(value))
    });
  }

  async function setTimePeriod(value) {
    await setStorage({
      timePeriod: normalizeTimePeriod(value)
    });
  }

  function getSince(timePeriod) {
    const now = Date.now();

    switch (timePeriod) {
      case "last_hour":
        return now - 60 * 60 * 1000;
      case "last_day":
        return now - 24 * 60 * 60 * 1000;
      case "last_week":
        return now - 7 * 24 * 60 * 60 * 1000;
      case "last_month":
        // Chrome 標準の "Last 4 weeks" と同じ 28 日基準（実月数ではない）。
        // 月またぎでも結果が一定になるよう固定日数を採用。
        return now - 28 * 24 * 60 * 60 * 1000;
      case "everything":
      default:
        return 0;
    }
  }

  function toRemoveObject(dataToRemove) {
    const result = {};

    for (const dataType of normalizeDataToRemove(dataToRemove)) {
      result[dataType] = true;
    }

    return result;
  }

  const CleanStartSettings = Object.freeze({
    DATA_TYPES,
    DATA_TYPE_MESSAGE_KEYS,
    STARTUP_RELOAD_DATA_TYPES,
    TIME_PERIODS,
    ensureDefaults,
    getSince,
    load,
    normalizeDataToRemove,
    normalizeSettings,
    normalizeTimePeriod,
    setDataToRemove,
    setFlag,
    setTimePeriod,
    toRemoveObject
  });

  global.CleanStartSettings = CleanStartSettings;

  // Node.js (テスト) 経由の利用にも対応するため CommonJS export を兼ねる。
  if (typeof module !== "undefined" && module.exports) {
    module.exports = CleanStartSettings;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
