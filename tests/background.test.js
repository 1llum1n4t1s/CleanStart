"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const BACKGROUND_SOURCE = fs.readFileSync(
  path.join(__dirname, "..", "src", "background", "background.js"),
  "utf8"
);

async function waitUntil(predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail("非同期処理が期待した状態へ到達しなかった");
}

test("起動時クリアへ手動クリアが重なっても削除と再読み込みを共有する", async () => {
  const listeners = {};
  const removeCallbacks = [];
  const removeCalls = [];
  const queryCalls = [];
  const settings = {
    autorefresh: true,
    clearonstartup: true,
    dataToRemove: ["cache"],
    timePeriod: "last_hour"
  };

  const chrome = {
    runtime: {
      id: "abcdefghijklmnopabcdefghijklmnop",
      lastError: null,
      onInstalled: { addListener: (listener) => { listeners.installed = listener; } },
      onStartup: { addListener: (listener) => { listeners.startup = listener; } },
      onMessage: { addListener: (listener) => { listeners.message = listener; } }
    },
    browsingData: {
      remove(options, removeObject, callback) {
        removeCalls.push({ options, removeObject });
        removeCallbacks.push(callback);
      }
    },
    tabs: {
      query(queryInfo, callback) {
        queryCalls.push(queryInfo);
        callback([]);
      },
      reload(_tabId, callback) {
        callback();
      }
    },
    action: {
      setBadgeBackgroundColor(_details, callback) { callback(); },
      setBadgeText(_details, callback) { callback(); }
    }
  };

  const context = {
    chrome,
    console,
    importScripts() {},
    setTimeout: (callback) => {
      queueMicrotask(callback);
      return 0;
    },
    CleanStartSettings: {
      STARTUP_RELOAD_DATA_TYPES: new Set(["cache"]),
      ensureDefaults: async () => settings,
      load: async () => settings,
      toRemoveObject: () => ({ cache: true }),
      getSince: () => 123
    },
    CleanStartSecurity: {
      isAuthorizedSender: () => true
    }
  };

  vm.runInNewContext(BACKGROUND_SOURCE, context, { filename: "background.js" });

  const startupPromise = listeners.startup();
  await waitUntil(() => removeCalls.length === 1);

  const responsePromise = new Promise((resolve) => {
    const keepsChannelOpen = listeners.message(
      { type: "clear-active-tab" },
      { id: chrome.runtime.id },
      resolve
    );
    assert.equal(keepsChannelOpen, true);
  });

  assert.equal(removeCalls.length, 1, "合流した手動要求は削除を追加しない");
  removeCallbacks[0]();

  const [response] = await Promise.all([responsePromise, startupPromise]);

  assert.equal(response.ok, true);
  assert.equal(removeCalls.length, 1, "browsingData.remove は1回だけ実行する");
  assert.equal(queryCalls.length, 2, "起動時の2段階 discovery を1系統だけ実行する");
});
