importScripts("../shared/settings.js");

const STARTUP_RELOAD_DISCOVERY_DELAYS = Object.freeze([1200, 2500]);
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

function getTabNavigationUrl(tab) {
  return String(tab?.pendingUrl || tab?.url || "").trim();
}

function isStartupReloadTarget(tab) {
  if (!tab?.id) {
    return false;
  }

  return /^https?:\/\//i.test(getTabNavigationUrl(tab));
}

async function reloadStartupTabs() {
  const reloadedTabs = new Set();

  for (const delayMs of STARTUP_RELOAD_DISCOVERY_DELAYS) {
    await sleep(delayMs);

    const tabs = await queryTabs({});
    const reloadTargets = tabs.filter((tab) =>
      isStartupReloadTarget(tab) && !reloadedTabs.has(tab.id)
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
}

async function reloadAllTabs() {
  const tabs = await queryTabs({});
  const targets = tabs.filter(isStartupReloadTarget);

  for (let i = 0; i < targets.length; i += STARTUP_RELOAD_BATCH_SIZE) {
    const batch = targets.slice(i, i + STARTUP_RELOAD_BATCH_SIZE);
    await Promise.all(batch.map((tab) => reloadTab(tab.id)));

    if (i + STARTUP_RELOAD_BATCH_SIZE < targets.length) {
      await sleep(STARTUP_RELOAD_INTERVAL_MS);
    }
  }
}

async function clearDataForTab() {
  const settings = await CleanStartSettings.load();
  return clearDataWithSettings(settings, { allowReload: true });
}

async function clearDataWithSettings(settings, options = {}) {
  const { allowReload = true } = options;
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

  if (allowReload && settings.autorefresh) {
    await reloadAllTabs();
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

chrome.runtime.onStartup.addListener(() => {
  // 更新直後の初回起動では onInstalled と同時発火しうるため、
  // 自身でも ensureDefaults を呼んで race を回避する（冪等）。
  CleanStartSettings.ensureDefaults()
    .then((settings) => {
      if (!settings.clearonstartup) {
        return null;
      }

      return clearDataWithSettings(settings, { allowReload: false })
        .then((result) => {
          if (!result?.shouldReloadStartupTabs) {
            return null;
          }

          return reloadStartupTabs();
        });
    })
    .catch((error) => {
      console.warn("Clean Start startup clear failed:", error.message);
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) {
    return undefined;
  }

  // 自拡張内 (popup/options) からのメッセージのみ受け付ける。
  // content script からのメッセージは sender.tab が設定されるため拒否する。
  if (sender.id !== chrome.runtime.id || sender.tab) {
    return undefined;
  }

  if (message.type === "clear-active-tab") {
    // message.tab は信用しない。background 側で activeTab を解決する。
    clearDataForTab()
      .then((result) => sendResponse(result))
      .catch((error) => {
        console.warn("Clean Start clear failed:", error.message);
        sendResponse({
          ok: false,
          error: error.message
        });
      });

    return true;
  }

  return undefined;
});
