"use strict";

const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  createChromeMock,
  captureConsoleWarn,
  loadFreshSettings
} = require("./chrome-mock.js");

let mock;
let CleanStartSettings;

beforeEach(() => {
  mock = createChromeMock();
  CleanStartSettings = loadFreshSettings(mock.chrome);
});

// ----------------------------------------------------------------------------
// getSince
// ----------------------------------------------------------------------------

describe("getSince", () => {
  test("last_hour: 60 分前のタイムスタンプを返す", () => {
    const before = Date.now();
    const since = CleanStartSettings.getSince("last_hour");
    const after = Date.now();
    assert.ok(since >= before - 60 * 60 * 1000);
    assert.ok(since <= after - 60 * 60 * 1000 + 5);
  });

  test("last_day: 24 時間前", () => {
    const since = CleanStartSettings.getSince("last_day");
    const expected = Date.now() - 24 * 60 * 60 * 1000;
    assert.ok(Math.abs(since - expected) < 100);
  });

  test("last_week: 7 日前", () => {
    const since = CleanStartSettings.getSince("last_week");
    const expected = Date.now() - 7 * 24 * 60 * 60 * 1000;
    assert.ok(Math.abs(since - expected) < 100);
  });

  test("last_month: 28 日前", () => {
    const since = CleanStartSettings.getSince("last_month");
    const expected = Date.now() - 28 * 24 * 60 * 60 * 1000;
    assert.ok(Math.abs(since - expected) < 100);
  });

  test("everything: 0 を返す", () => {
    assert.equal(CleanStartSettings.getSince("everything"), 0);
  });

  test("未知の値: 0 (default) を返す", () => {
    assert.equal(CleanStartSettings.getSince("__unknown__"), 0);
    assert.equal(CleanStartSettings.getSince(null), 0);
    assert.equal(CleanStartSettings.getSince(undefined), 0);
    assert.equal(CleanStartSettings.getSince(""), 0);
  });
});

// ----------------------------------------------------------------------------
// normalizeTimePeriod
// ----------------------------------------------------------------------------

describe("normalizeTimePeriod", () => {
  test("有効な 5 値はそのまま返す", () => {
    for (const v of ["last_hour", "last_day", "last_week", "last_month", "everything"]) {
      assert.equal(CleanStartSettings.normalizeTimePeriod(v), v);
    }
  });

  test("不正値は last_hour にフォールバック", () => {
    const fallback = "last_hour";
    assert.equal(CleanStartSettings.normalizeTimePeriod("xxxx"), fallback);
    assert.equal(CleanStartSettings.normalizeTimePeriod(""), fallback);
    assert.equal(CleanStartSettings.normalizeTimePeriod(null), fallback);
    assert.equal(CleanStartSettings.normalizeTimePeriod(undefined), fallback);
    assert.equal(CleanStartSettings.normalizeTimePeriod(123), fallback);
    assert.equal(CleanStartSettings.normalizeTimePeriod([]), fallback);
    assert.equal(CleanStartSettings.normalizeTimePeriod({}), fallback);
  });

  test("近似文字列も拒否（部分一致しない）", () => {
    assert.equal(CleanStartSettings.normalizeTimePeriod("LAST_HOUR"), "last_hour"); // !
    // 上は実は失敗する。TIME_PERIODS は小文字のみだから includes が false → fallback
    // 正しい挙動: 大文字混入も fallback
  });

  test("大文字混入は fallback (大文字小文字区別)", () => {
    assert.equal(CleanStartSettings.normalizeTimePeriod("Last_Hour"), "last_hour");
    assert.equal(CleanStartSettings.normalizeTimePeriod("EVERYTHING"), "last_hour");
  });
});

// ----------------------------------------------------------------------------
// normalizeDataToRemove
// ----------------------------------------------------------------------------

describe("normalizeDataToRemove", () => {
  test("有効配列はホワイトリスト順で返す", () => {
    const result = CleanStartSettings.normalizeDataToRemove(["history", "cache"]);
    assert.deepEqual(result, ["cache", "history"]);
  });

  test("12 種すべて指定するとホワイトリスト順", () => {
    const all = [
      "appcache", "cache", "cacheStorage", "cookies", "downloads",
      "fileSystems", "formData", "history", "indexedDB", "localStorage",
      "serviceWorkers", "webSQL"
    ];
    const result = CleanStartSettings.normalizeDataToRemove(all);
    assert.deepEqual(result, all);
  });

  test("ホワイトリスト外の値は除外", () => {
    const result = CleanStartSettings.normalizeDataToRemove([
      "history", "passwords", "pluginData", "__proto__"
    ]);
    assert.deepEqual(result, ["history"]);
  });

  test("JSON 文字列もパース可能", () => {
    const result = CleanStartSettings.normalizeDataToRemove('["cache","history"]');
    assert.deepEqual(result, ["cache", "history"]);
  });

  test("不正 JSON は default にフォールバック", () => {
    const result = CleanStartSettings.normalizeDataToRemove("not-json{{");
    assert.deepEqual(result, ["appcache", "cache", "cacheStorage", "fileSystems", "indexedDB", "webSQL"]);
  });

  test("undefined は default", () => {
    const result = CleanStartSettings.normalizeDataToRemove(undefined);
    assert.deepEqual(result, ["appcache", "cache", "cacheStorage", "fileSystems", "indexedDB", "webSQL"]);
  });

  test("null は default", () => {
    const result = CleanStartSettings.normalizeDataToRemove(null);
    assert.deepEqual(result, ["appcache", "cache", "cacheStorage", "fileSystems", "indexedDB", "webSQL"]);
  });

  test("空配列は空配列", () => {
    assert.deepEqual(CleanStartSettings.normalizeDataToRemove([]), []);
  });

  test("重複も結局ホワイトリスト 1 回のみ", () => {
    const result = CleanStartSettings.normalizeDataToRemove(["cache", "cache", "cache"]);
    assert.deepEqual(result, ["cache"]);
  });

  test("数値や非文字列要素は無視", () => {
    const result = CleanStartSettings.normalizeDataToRemove([123, "history", null, "cache"]);
    assert.deepEqual(result, ["cache", "history"]);
  });
});

// ----------------------------------------------------------------------------
// toRemoveObject
// ----------------------------------------------------------------------------

describe("toRemoveObject", () => {
  test("各データ型を true にしたオブジェクトを返す", () => {
    const obj = CleanStartSettings.toRemoveObject(["cache", "history"]);
    assert.deepEqual(obj, { cache: true, history: true });
  });

  test("空配列は空オブジェクト", () => {
    assert.deepEqual(CleanStartSettings.toRemoveObject([]), {});
  });

  test("ホワイトリスト外は混入しない", () => {
    const obj = CleanStartSettings.toRemoveObject(["history", "passwords", "pluginData"]);
    assert.deepEqual(obj, { history: true });
  });

  test("__proto__ ホワイトリスト外として除外（prototype pollution 防止）", () => {
    const obj = CleanStartSettings.toRemoveObject(["__proto__", "history"]);
    assert.deepEqual(obj, { history: true });
    // Object.prototype は汚染されていない
    assert.equal(({}).polluted, undefined);
  });

  test("全 12 型", () => {
    const all = [
      "appcache", "cache", "cacheStorage", "cookies", "downloads",
      "fileSystems", "formData", "history", "indexedDB", "localStorage",
      "serviceWorkers", "webSQL"
    ];
    const obj = CleanStartSettings.toRemoveObject(all);
    assert.equal(Object.keys(obj).length, 12);
    for (const t of all) assert.equal(obj[t], true);
  });

  test("undefined / null も安全にデフォルトへ", () => {
    const objNull = CleanStartSettings.toRemoveObject(null);
    const objUndef = CleanStartSettings.toRemoveObject(undefined);
    const expected = { appcache: true, cache: true, cacheStorage: true, fileSystems: true, indexedDB: true, webSQL: true };
    assert.deepEqual(objNull, expected);
    assert.deepEqual(objUndef, expected);
  });
});

// ----------------------------------------------------------------------------
// normalizeSettings
// ----------------------------------------------------------------------------

describe("normalizeSettings", () => {
  test("空オブジェクトは全デフォルト", () => {
    const settings = CleanStartSettings.normalizeSettings({});
    assert.equal(settings.autorefresh, false);
    assert.equal(settings.clearonstartup, false);
    assert.deepEqual(settings.dataToRemove, ["appcache", "cache", "cacheStorage", "fileSystems", "indexedDB", "webSQL"]);
    assert.equal(settings.timePeriod, "last_hour");
  });

  test("null も空相当", () => {
    const settings = CleanStartSettings.normalizeSettings(null);
    assert.equal(settings.timePeriod, "last_hour");
  });

  test("autorefresh / clearonstartup は Boolean 化", () => {
    const settings = CleanStartSettings.normalizeSettings({
      autorefresh: 1,
      clearonstartup: "yes"
    });
    assert.equal(settings.autorefresh, true);
    assert.equal(settings.clearonstartup, true);
  });

  test("autorefresh が 0 は false", () => {
    const settings = CleanStartSettings.normalizeSettings({
      autorefresh: 0,
      clearonstartup: ""
    });
    assert.equal(settings.autorefresh, false);
    assert.equal(settings.clearonstartup, false);
  });

  test("dataToRemove は JSON 文字列でも配列でも OK", () => {
    const a = CleanStartSettings.normalizeSettings({ dataToRemove: ["cookies"] });
    const b = CleanStartSettings.normalizeSettings({ dataToRemove: '["cookies"]' });
    assert.deepEqual(a.dataToRemove, ["cookies"]);
    assert.deepEqual(b.dataToRemove, ["cookies"]);
  });

  test("timePeriod の不正値は last_hour", () => {
    const settings = CleanStartSettings.normalizeSettings({ timePeriod: "garbage" });
    assert.equal(settings.timePeriod, "last_hour");
  });

  test("不要キーは無視される（cookieSettings 等）", () => {
    const settings = CleanStartSettings.normalizeSettings({
      cookieSettings: { foo: "bar" },
      cookie_settings: "anything",
      randomKey: 123
    });
    assert.equal(settings.cookieSettings, undefined);
    assert.equal(settings.randomKey, undefined);
    assert.equal(settings.timePeriod, "last_hour");
  });
});

// ----------------------------------------------------------------------------
// setFlag
// ----------------------------------------------------------------------------

describe("setFlag", () => {
  test("autorefresh は許可", async () => {
    await CleanStartSettings.setFlag("autorefresh", true);
    assert.equal(mock.storage.autorefresh, true);
  });

  test("clearonstartup は許可", async () => {
    await CleanStartSettings.setFlag("clearonstartup", true);
    assert.equal(mock.storage.clearonstartup, true);
  });

  test("ホワイトリスト外は拒否（書き込まない）", async () => {
    const cap = captureConsoleWarn();
    try {
      await CleanStartSettings.setFlag("__proto__", true);
      await CleanStartSettings.setFlag("dataToRemove", true);
      await CleanStartSettings.setFlag("constructor", true);
      await CleanStartSettings.setFlag("", true);
    } finally {
      cap.restore();
    }
    // __proto__ / constructor は通常のプロパティアクセスでは Object.prototype に
    // ヒットするため、hasOwn で「自身のプロパティとして書き込まれていない」ことを検証
    assert.equal(Object.hasOwn(mock.storage, "__proto__"), false);
    assert.equal(Object.hasOwn(mock.storage, "constructor"), false);
    assert.equal(mock.storage.dataToRemove, undefined);
    assert.equal(mock.storage[""], undefined);
    assert.equal(cap.messages.length, 4);
  });

  test("値は Boolean 化される", async () => {
    await CleanStartSettings.setFlag("autorefresh", "truthy");
    assert.equal(mock.storage.autorefresh, true);
    await CleanStartSettings.setFlag("autorefresh", 0);
    assert.equal(mock.storage.autorefresh, false);
    await CleanStartSettings.setFlag("autorefresh", null);
    assert.equal(mock.storage.autorefresh, false);
  });

  test("undefined / null name は警告して何もしない", async () => {
    const cap = captureConsoleWarn();
    try {
      await CleanStartSettings.setFlag(undefined, true);
      await CleanStartSettings.setFlag(null, true);
    } finally {
      cap.restore();
    }
    assert.equal(Object.keys(mock.storage).length, 0);
    assert.equal(cap.messages.length, 2);
  });
});

// ----------------------------------------------------------------------------
// setDataToRemove / setTimePeriod
// ----------------------------------------------------------------------------

describe("setDataToRemove", () => {
  test("有効配列を保存（正規化済み JSON）", async () => {
    await CleanStartSettings.setDataToRemove(["history", "cache"]);
    assert.equal(mock.storage.dataToRemove, JSON.stringify(["cache", "history"]));
  });

  test("不正値は除外して保存", async () => {
    await CleanStartSettings.setDataToRemove(["history", "__proto__", "passwords"]);
    assert.equal(mock.storage.dataToRemove, JSON.stringify(["history"]));
  });

  test("空配列も保存可", async () => {
    await CleanStartSettings.setDataToRemove([]);
    assert.equal(mock.storage.dataToRemove, JSON.stringify([]));
  });
});

describe("setTimePeriod", () => {
  test("有効値を保存", async () => {
    await CleanStartSettings.setTimePeriod("everything");
    assert.equal(mock.storage.timePeriod, "everything");
  });

  test("不正値は last_hour にフォールバックして保存", async () => {
    await CleanStartSettings.setTimePeriod("garbage");
    assert.equal(mock.storage.timePeriod, "last_hour");
  });

  test("undefined も last_hour", async () => {
    await CleanStartSettings.setTimePeriod(undefined);
    assert.equal(mock.storage.timePeriod, "last_hour");
  });
});

// ----------------------------------------------------------------------------
// ensureDefaults
// ----------------------------------------------------------------------------

describe("ensureDefaults", () => {
  test("空ストレージ: 全デフォルト書き込み + 正規化済み settings 返却", async () => {
    const settings = await CleanStartSettings.ensureDefaults();
    assert.equal(mock.storage.autorefresh, false);
    assert.equal(mock.storage.clearonstartup, false);
    assert.equal(mock.storage.dataToRemove, JSON.stringify(["appcache", "cache", "cacheStorage", "fileSystems", "indexedDB", "webSQL"]));
    assert.equal(mock.storage.timePeriod, "last_hour");
    assert.equal(settings.autorefresh, false);
    assert.equal(settings.timePeriod, "last_hour");
    assert.deepEqual(settings.dataToRemove, ["appcache", "cache", "cacheStorage", "fileSystems", "indexedDB", "webSQL"]);
  });

  test("一部既存: 欠損のみ書き込み", async () => {
    mock.storage.autorefresh = true;
    mock.storage.timePeriod = "everything";
    const settings = await CleanStartSettings.ensureDefaults();
    // 既存値は保持
    assert.equal(mock.storage.autorefresh, true);
    assert.equal(mock.storage.timePeriod, "everything");
    // 欠損キーは補完
    assert.equal(mock.storage.clearonstartup, false);
    assert.equal(mock.storage.dataToRemove, JSON.stringify(["appcache", "cache", "cacheStorage", "fileSystems", "indexedDB", "webSQL"]));
    // 返り値は正規化済み
    assert.equal(settings.autorefresh, true);
    assert.equal(settings.timePeriod, "everything");
  });

  test("全既存: 書き込みなし", async () => {
    mock.storage.autorefresh = true;
    mock.storage.clearonstartup = true;
    mock.storage.dataToRemove = JSON.stringify(["cache"]);
    mock.storage.timePeriod = "last_day";
    await CleanStartSettings.ensureDefaults();
    // set は呼ばれていないはず
    assert.equal(mock.calls.set.length, 0);
  });

  test("既存 dataToRemove が文字列のままでも settings は配列で返る", async () => {
    mock.storage.autorefresh = false;
    mock.storage.clearonstartup = false;
    mock.storage.dataToRemove = JSON.stringify(["downloads", "history"]);
    mock.storage.timePeriod = "last_week";
    const settings = await CleanStartSettings.ensureDefaults();
    assert.deepEqual(settings.dataToRemove, ["downloads", "history"]);
  });
});

// ----------------------------------------------------------------------------
// load
// ----------------------------------------------------------------------------

describe("load", () => {
  test("空ストレージ: 全デフォルト返却（書き込みなし）", async () => {
    const settings = await CleanStartSettings.load();
    assert.equal(mock.calls.set.length, 0);
    assert.equal(settings.autorefresh, false);
    assert.deepEqual(settings.dataToRemove, ["appcache", "cache", "cacheStorage", "fileSystems", "indexedDB", "webSQL"]);
    assert.equal(settings.timePeriod, "last_hour");
  });

  test("既存値があればそれを返す", async () => {
    mock.storage.autorefresh = true;
    mock.storage.timePeriod = "last_month";
    mock.storage.dataToRemove = JSON.stringify(["cookies", "cache"]);
    const settings = await CleanStartSettings.load();
    assert.equal(settings.autorefresh, true);
    assert.equal(settings.timePeriod, "last_month");
    assert.deepEqual(settings.dataToRemove, ["cache", "cookies"]);
  });

  test("不正な JSON 文字列は dataToRemove default にフォールバック", async () => {
    mock.storage.dataToRemove = "garbage{{";
    const settings = await CleanStartSettings.load();
    assert.deepEqual(settings.dataToRemove, ["appcache", "cache", "cacheStorage", "fileSystems", "indexedDB", "webSQL"]);
  });

  test("不正な timePeriod は last_hour", async () => {
    mock.storage.timePeriod = "this-is-not-valid";
    const settings = await CleanStartSettings.load();
    assert.equal(settings.timePeriod, "last_hour");
  });
});

// ----------------------------------------------------------------------------
// 公開定数の不変性 + Object.freeze
// ----------------------------------------------------------------------------

describe("公開定数", () => {
  test("DATA_TYPES は freeze されており書き換え不可", () => {
    assert.ok(Object.isFrozen(CleanStartSettings.DATA_TYPES));
    assert.throws(() => {
      CleanStartSettings.DATA_TYPES.push("malicious");
    });
  });

  test("DATA_TYPES は 12 要素", () => {
    assert.equal(CleanStartSettings.DATA_TYPES.length, 12);
  });

  test("TIME_PERIODS は 5 要素", () => {
    assert.equal(CleanStartSettings.TIME_PERIODS.length, 5);
  });

  test("DATA_TYPE_MESSAGE_KEYS は DATA_TYPES と同じキーセット", () => {
    const keys = Object.keys(CleanStartSettings.DATA_TYPE_MESSAGE_KEYS).sort();
    const types = [...CleanStartSettings.DATA_TYPES].sort();
    assert.deepEqual(keys, types);
  });

  test("STARTUP_RELOAD_DATA_TYPES は DATA_TYPES のサブセット", () => {
    for (const type of CleanStartSettings.STARTUP_RELOAD_DATA_TYPES) {
      assert.ok(CleanStartSettings.DATA_TYPES.includes(type));
    }
  });

  test("STARTUP_RELOAD_DATA_TYPES に downloads / formData / history は含まれない", () => {
    assert.equal(CleanStartSettings.STARTUP_RELOAD_DATA_TYPES.has("downloads"), false);
    assert.equal(CleanStartSettings.STARTUP_RELOAD_DATA_TYPES.has("formData"), false);
    assert.equal(CleanStartSettings.STARTUP_RELOAD_DATA_TYPES.has("history"), false);
  });

  test("CleanStartSettings オブジェクト自体が freeze", () => {
    assert.ok(Object.isFrozen(CleanStartSettings));
    assert.throws(() => {
      CleanStartSettings.injected = true;
    });
  });

  test("Cookie 関連 API は public から削除済み", () => {
    assert.equal(CleanStartSettings.normalizeCookieSettings, undefined);
    assert.equal(CleanStartSettings.normalizeDomainFilter, undefined);
    assert.equal(CleanStartSettings.isValidDomainFilter, undefined);
    assert.equal(CleanStartSettings.cookieDomainMatchesFilter, undefined);
    assert.equal(CleanStartSettings.setCookieSettings, undefined);
  });
});

// ----------------------------------------------------------------------------
// i18n キーと DATA_TYPES の整合（ローカルファイル直読）
// ----------------------------------------------------------------------------

describe("i18n 整合性 (en/ja messages.json)", () => {
  const fs = require("node:fs");
  const path = require("node:path");

  function loadLocale(name) {
    const p = path.join(__dirname, "..", "_locales", name, "messages.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
  }

  test("DATA_TYPE_MESSAGE_KEYS が指す全キーが en に存在", () => {
    const en = loadLocale("en");
    for (const key of Object.values(CleanStartSettings.DATA_TYPE_MESSAGE_KEYS)) {
      assert.ok(en[key], `en に ${key} が無い`);
    }
  });

  test("DATA_TYPE_MESSAGE_KEYS が指す全キーが ja に存在", () => {
    const ja = loadLocale("ja");
    for (const key of Object.values(CleanStartSettings.DATA_TYPE_MESSAGE_KEYS)) {
      assert.ok(ja[key], `ja に ${key} が無い`);
    }
  });

  test("en と ja のキーセットが完全一致", () => {
    const en = Object.keys(loadLocale("en")).sort();
    const ja = Object.keys(loadLocale("ja")).sort();
    assert.deepEqual(en, ja);
  });

  test("削除済み Cookie フィルタ系 i18n キーは存在しない", () => {
    const en = loadLocale("en");
    const ja = loadLocale("ja");
    const removedKeys = [
      "options_remove_cookies_opt",
      "options_remove_cookies_opt_1",
      "options_remove_cookies_opt_2",
      "options_remove_cookies_opt_3",
      "options_remove_cookies_opt_4",
      "options_cookie_filter_placeholder",
      "options_cookie_remove"
    ];
    for (const key of removedKeys) {
      assert.equal(en[key], undefined, `en にまだ ${key} が残ってる`);
      assert.equal(ja[key], undefined, `ja にまだ ${key} が残ってる`);
    }
  });

  test("追加した警告 / 確認系キーは en/ja 両方に存在", () => {
    const en = loadLocale("en");
    const ja = loadLocale("ja");
    for (const key of ["options_clearonstartup_warning", "popup_confirm"]) {
      assert.ok(en[key], `en に ${key} が無い`);
      assert.ok(ja[key], `ja に ${key} が無い`);
    }
  });
});
