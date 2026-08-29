importScripts("../shared/settings.js");
importScripts("../shared/security.js");

// 起動直後はタブ一覧の取得タイミングがブラウザ側で確定していない。
// 1.2s と 2.5s の 2 回に分けて discovery することで、後から復元される
// セッションタブも漏らさず拾う（実測ベースの値、Chrome 120 系で安定）。
const STARTUP_RELOAD_DISCOVERY_DELAYS = Object.freeze([1200, 2500]);
// reloadAllTabs / reloadStartupTabs のバッチ間スリープ。
// あまり短いと chrome.tabs.reload が瞬間的にスロットリングされる。
const STARTUP_RELOAD_INTERVAL_MS = 250;
const STARTUP_RELOAD_BATCH_SIZE = 5;

function browsingDataRemove(options, removeObject) {
  return new Promise((resolve, reject) => {
    chrome.browsingData.remove(options, removeObject, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve();
    });
  });
}

function queryTabs(queryInfo) {
  return new Promise((resolve) => {
    chrome.tabs.query(queryInfo, (tabs) => {
      if (chrome.runtime.lastError) {
        resolve([]);
        return;
      }

      resolve(tabs || []);
    });
  });
}

function reloadTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.reload(tabId, () => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }

      resolve(true);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// エラーが起きたことをユーザーに気付かせるための赤バッジ。
// console.warn だけでは popup を開かないユーザーが永久に異常に気付けない。
// popup 起動時に setBadgeText("") でリセットされる（popup.js 側）。
function showErrorBadge() {
  setBadge("!", "#d32f2f");
}

function setBadge(text, color) {
  try {
    chrome.action.setBadgeBackgroundColor({ color }, () => {
      void chrome.runtime.lastError;
    });
    chrome.action.setBadgeText({ text }, () => {
      void chrome.runtime.lastError;
    });
  } catch (_error) {
    // chrome.action 未対応環境では静かに失敗
  }
}

function getTabNavigationUrl(tab) {
  return String(tab?.pendingUrl || tab?.url || "").trim();
}

function isHttpTab(tab) {
  if (!tab?.id) {
    return false;
  }

  return /^https?:\/\//i.test(getTabNavigationUrl(tab));
}

// onInstalled と onStartup の二重発火等で並走しないよう SW モジュールスコープでガード。
let reloadStartupTabsRunning = false;

async function reloadStartupTabs() {
  if (reloadStartupTabsRunning) {
    return;
  }
  reloadStartupTabsRunning = true;
  try {
    const reloadedTabs = new Set();

    for (const delayMs of STARTUP_RELOAD_DISCOVERY_DELAYS) {
      await sleep(delayMs);

      // url パターンで API 側フィルタ → JS 側の isHttpTab は重複排除のフォールバック扱い
      const tabs = await queryTabs({ url: ["http://*/*", "https://*/*"] });
      const reloadTargets = tabs.filter((tab) =>
        isHttpTab(tab) && !reloadedTabs.has(tab.id)
      );

      for (let i = 0; i < reloadTargets.length; i += STARTUP_RELOAD_BATCH_SIZE) {
        const batch = reloadTargets.slice(i, i + STARTUP_RELOAD_BATCH_SIZE);
        await Promise.all(batch.map((tab) => {
          reloadedTabs.add(tab.id);
          return reloadTab(tab.id);
        }));

        if (i + STARTUP_RELOAD_BATCH_SIZE < reloadTargets.length) {
          await sleep(STARTUP_RELOAD_INTERVAL_MS);
        }
      }
    }
  } finally {
    reloadStartupTabsRunning = false;
  }
}

// 手動クリア後のリロードは autorefresh ON のとき全 HTTP タブに対して実行する。
// browsingData.remove はプロファイル全体のキャッシュ等を消すため、
// アクティブタブだけリロードしても他タブは古いキャッシュ参照のままになる。
// ユーザー想定の挙動と揃えるため tabs 権限の範囲で全 HTTP タブを対象とする。
async function reloadAllTabs() {
  const tabs = await queryTabs({ url: ["http://*/*", "https://*/*"] });
  const targets = tabs.filter(isHttpTab);

  for (let i = 0; i < targets.length; i += STARTUP_RELOAD_BATCH_SIZE) {
    const batch = targets.slice(i, i + STARTUP_RELOAD_BATCH_SIZE);
    await Promise.all(batch.map((tab) => reloadTab(tab.id)));

    if (i + STARTUP_RELOAD_BATCH_SIZE < targets.length) {
      await sleep(STARTUP_RELOAD_INTERVAL_MS);
    }
  }
}

// 手動クリアと起動時クリアが重なっても browsingData.remove を二重に走らせない。
// 後から合流した呼び出しの reload 意図も共有し、起動時 reload を優先する。
let inFlightClear = null;
let inFlightClearIntent = null;

function clearDataWithCurrentSettings() {
  return runClear(
    () => CleanStartSettings.load(),
    { manual: true }
  );
}

function clearDataOnStartup(settings) {
  return runClear(
    () => Promise.resolve(settings),
    { startup: true }
  );
}

function runClear(loadSettings, intent) {
  if (inFlightClear) {
    inFlightClearIntent.manual ||= Boolean(intent.manual);
    inFlightClearIntent.startup ||= Boolean(intent.startup);
    return inFlightClear;
  }

  inFlightClearIntent = {
    manual: Boolean(intent.manual),
    startup: Boolean(intent.startup)
  };

  const run = (async () => {
    const settings = await loadSettings();
    const result = await clearDataWithSettings(settings);

    if (inFlightClearIntent.startup && result.shouldReloadStartupTabs) {
      await reloadStartupTabs();
    } else if (inFlightClearIntent.manual && settings.autorefresh) {
      await reloadAllTabs();
    }

    return result;
  })();

  inFlightClear = run.finally(() => {
    inFlightClear = null;
    inFlightClearIntent = null;
  });

  return inFlightClear;
}

async function clearDataWithSettings(settings) {
  const removeObject = CleanStartSettings.toRemoveObject(settings.dataToRemove);
  const shouldReloadStartupTabs = settings.dataToRemove.some((dataType) =>
    CleanStartSettings.STARTUP_RELOAD_DATA_TYPES.has(dataType)
  );

  if (Object.keys(removeObject).length > 0) {
    await browsingDataRemove(
      { since: CleanStartSettings.getSince(settings.timePeriod) },
      removeObject
    );
  }

  return {
    ok: true,
    shouldReloadStartupTabs
  };
}

async function initialize(_details) {
  await CleanStartSettings.ensureDefaults();
}

chrome.runtime.onInstalled.addListener((details) => {
  initialize(details).catch((error) => {
    console.warn("Clean Start install initialization failed:", error.message);
  });
});

chrome.runtime.onStartup.addListener(async () => {
  // 更新直後の初回起動では onInstalled と同時発火しうるため、
  // 自身でも ensureDefaults を呼んで race を回避する（冪等）。
  // 全処理は ~5 秒で完了し、SW の 30 秒猶予期間内に収まる。
  try {
    const settings = await CleanStartSettings.ensureDefaults();

    if (!settings.clearonstartup) {
      return;
    }

    await clearDataOnStartup(settings);
  } catch (error) {
    console.warn("Clean Start startup clear failed:", error.message);
    showErrorBadge();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) {
    return undefined;
  }

  // sender 検証は security.js の pure function に委譲（テスト可能化）。
  if (!CleanStartSecurity.isAuthorizedSender(sender, chrome.runtime.id)) {
    return undefined;
  }

  if (message.type === "clear-active-tab") {
    // message.tab は信用しない。削除対象は chrome.storage の設定だけで決まり、
    // browsingData はプロファイル全体に効くため、送信元タブの情報は一切使わない。
    clearDataWithCurrentSettings()
      .then((result) => sendResponse(result))
      .catch((error) => {
        console.warn("Clean Start clear failed:", error.message);
        showErrorBadge();
        sendResponse({
          ok: false,
          error: error.message
        });
      });

    return true;
  }

  return undefined;
});
