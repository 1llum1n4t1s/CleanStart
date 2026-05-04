(function initializePopup() {
  const CLEAR_DONE_DISPLAY_MS = 1600;

  const clearButton = document.getElementById("clear-btn");
  const clearLabel = clearButton.querySelector("[data-role='label']");
  const autorefresh = document.getElementById("autorefresh");
  const clearOnStartup = document.getElementById("clearonstartup");
  const clearOnStartupWarning = document.getElementById("clearonstartup-warning");
  const removeInputs = Array.from(document.querySelectorAll("#remove-list input[type='checkbox']"));
  const timePeriodInputs = Array.from(document.querySelectorAll("#time-period input[type='radio']"));
  const selectionTags = document.getElementById("selection-tags");
  const periodChip = document.getElementById("period-chip");

  let currentSettings = null;

  function getLabel(messageKey, fallback) {
    return chrome.i18n.getMessage(messageKey) || fallback;
  }

  const labels = {
    idle: getLabel("popup_clear", "Clear"),
    busy: getLabel("popup_clearing", "Clearing..."),
    done: getLabel("popup_clean", "Done")
  };

  function createSelectionChip(text, variant) {
    const tag = document.createElement("span");
    tag.className = "selection-chip";

    if (variant) {
      tag.classList.add(`selection-chip-${variant}`);
    }

    tag.textContent = text;
    return tag;
  }

  function updateSelectionSummary() {
    if (!currentSettings) {
      return;
    }

    const timeKey = CleanStartSettings.TIME_PERIOD_MESSAGE_KEYS[currentSettings.timePeriod];
    periodChip.textContent = getLabel(timeKey, currentSettings.timePeriod);

    selectionTags.innerHTML = "";

    if (currentSettings.dataToRemove.length === 0) {
      selectionTags.appendChild(
        createSelectionChip(
          getLabel("popup_nothing_selected", "Nothing selected"),
          "empty"
        )
      );
      return;
    }

    currentSettings.dataToRemove.forEach((dataType) => {
      const messageKey = CleanStartSettings.DATA_TYPE_MESSAGE_KEYS[dataType];
      selectionTags.appendChild(
        createSelectionChip(getLabel(messageKey, dataType))
      );
    });
  }

  function updateClearOnStartupWarning() {
    if (!clearOnStartupWarning) {
      return;
    }
    clearOnStartupWarning.hidden = !clearOnStartup.checked;
  }

  function render(settings) {
    currentSettings = settings;
    autorefresh.checked = settings.autorefresh;
    clearOnStartup.checked = settings.clearonstartup;
    updateClearOnStartupWarning();

    removeInputs.forEach((input) => {
      input.checked = settings.dataToRemove.includes(input.value);
    });

    timePeriodInputs.forEach((input) => {
      input.checked = input.value === settings.timePeriod;
    });

    updateSelectionSummary();
  }

  function safeAsync(handler) {
    return (event) => {
      Promise.resolve(handler(event)).catch((error) => {
        console.warn("Clean Start handler failed:", error?.message || error);
      });
    };
  }

  // SW 終了→cold-start で sendMessage が失敗する稀ケースに備え、
  // 1 度だけ短いリトライを挟む。タイムアウトも合わせて設けることで、
  // popup が "busy" 状態のまま固着する事故を避ける。
  const SEND_MESSAGE_TIMEOUT_MS = 15000;

  function sendRuntimeMessageOnce(message) {
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ ok: false, error: "timeout" });
      }, SEND_MESSAGE_TIMEOUT_MS);

      chrome.runtime.sendMessage(message, (response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          resolve({
            ok: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }
        resolve(response || { ok: true });
      });
    });
  }

  async function sendRuntimeMessage(message) {
    const first = await sendRuntimeMessageOnce(message);
    if (first?.ok) {
      return first;
    }
    // SW cold-start 中で配送失敗した可能性のあるエラーのみリトライ。
    const retryablePatterns = [
      "Could not establish connection",
      "message port was closed",
      "Receiving end does not exist",
      "timeout"
    ];
    const message_str = typeof first?.error === "string" ? first.error : "";
    if (!retryablePatterns.some((p) => message_str.includes(p))) {
      return first;
    }
    await new Promise((r) => setTimeout(r, 500));
    return sendRuntimeMessageOnce(message);
  }

  function updateStoreLink() {
    const storeLink = document.querySelector(".teaser");
    const updateUrl = chrome.runtime.getManifest().update_url?.toLowerCase();
    const extensionId = chrome.runtime.id;
    const href = updateUrl && updateUrl.includes("microsoft")
      ? "https://microsoftedge.microsoft.com/addons/detail/" + extensionId
      : "https://chromewebstore.google.com/detail/" + extensionId;

    storeLink.href = href;
  }

  // ---- 2 段階 Clear UI ----
  // idle → confirming（5秒タイマー）→ もう一度押せば busy → done → idle
  const CONFIRM_TIMEOUT_MS = 5000;
  let confirmTimeoutId = null;

  function setClearButtonStateExtended(state) {
    clearButton.dataset.state = state;
    clearButton.disabled = state === "busy";

    if (state === "confirming") {
      clearLabel.textContent = getLabel("popup_confirm", "Tap again to clear");
    } else {
      clearLabel.textContent = labels[state] || labels.idle;
    }
  }

  function cancelConfirmTimer() {
    if (confirmTimeoutId !== null) {
      window.clearTimeout(confirmTimeoutId);
      confirmTimeoutId = null;
    }
  }

  async function performActualClear() {
    setClearButtonStateExtended("busy");

    try {
      const result = await sendRuntimeMessage({ type: "clear-active-tab" });

      if (!result?.ok) {
        console.warn("Clean Start clear failed:", result?.error || "Unknown error");
        setClearButtonStateExtended("idle");
        return;
      }

      setClearButtonStateExtended("done");
      window.setTimeout(() => setClearButtonStateExtended("idle"), CLEAR_DONE_DISPLAY_MS);
    } catch (error) {
      console.warn("Clean Start clear failed:", error?.message || error);
      setClearButtonStateExtended("idle");
    }
  }

  async function handleClearClick() {
    const currentState = clearButton.dataset.state;

    if (currentState === "confirming") {
      cancelConfirmTimer();
      await performActualClear();
      return;
    }

    if (currentState === "busy" || currentState === "done") {
      return;
    }

    // idle → confirming に遷移し、CONFIRM_TIMEOUT_MS で自動 idle 復帰。
    setClearButtonStateExtended("confirming");
    cancelConfirmTimer();
    confirmTimeoutId = window.setTimeout(() => {
      setClearButtonStateExtended("idle");
      confirmTimeoutId = null;
    }, CONFIRM_TIMEOUT_MS);
  }

  async function loadSettingsIntoPopup() {
    // background SW の onInstalled で ensureDefaults() 済み。popup は load() のみ。
    const settings = await CleanStartSettings.load();
    render(settings);
  }

  // SW がエラー時にセットした ! バッジを popup を開いたタイミングで消す。
  // ユーザーが popup を開いた = 「異常に気付いた」と見なせるので、
  // 見たという acknowledge と同義として扱う。
  function clearActionBadge() {
    try {
      chrome.action.setBadgeText({ text: "" }, () => {
        void chrome.runtime.lastError;
      });
    } catch (_error) {
      // chrome.action 未対応環境では無視
    }
  }

  // chrome.storage.onChanged は自分の write でも発火する。
  // ユーザー操作が連続したとき N+1 で storage read が走り UI ちらつきの原因になるため、
  // 自身の write 直後 200ms は無視する止血を入れる。
  // 外部からの変更 (SW の ensureDefaults 等) のみ反映する想定。
  const SELF_WRITE_SUPPRESS_MS = 200;
  let selfWriteSuppressUntil = 0;
  function markSelfWrite() {
    selfWriteSuppressUntil = Date.now() + SELF_WRITE_SUPPRESS_MS;
  }

  function handleStorageChange(changes, areaName) {
    if (areaName !== "local") {
      return;
    }
    if (Date.now() < selfWriteSuppressUntil) {
      return;
    }
    loadSettingsIntoPopup().catch((error) => {
      console.warn("Clean Start storage sync failed:", error?.message || error);
    });
  }

  const localization = new Localize();
  localization.apply();
  setClearButtonStateExtended("idle");
  // SW がセットしたエラーバッジ (!) を popup 起動時に消す。
  // background.js:showErrorBadge との対称契約。
  clearActionBadge();
  chrome.storage.onChanged.addListener(handleStorageChange);

  clearButton.addEventListener("click", safeAsync(handleClearClick));
  autorefresh.addEventListener("change", safeAsync(async (event) => {
    if (!currentSettings) {
      return;
    }

    currentSettings.autorefresh = event.target.checked;
    markSelfWrite();
    await CleanStartSettings.setFlag("autorefresh", event.target.checked);
  }));
  clearOnStartup.addEventListener("change", safeAsync(async (event) => {
    if (!currentSettings) {
      return;
    }

    currentSettings.clearonstartup = event.target.checked;
    updateClearOnStartupWarning();
    markSelfWrite();
    await CleanStartSettings.setFlag("clearonstartup", event.target.checked);
  }));
  removeInputs.forEach((input) => {
    input.addEventListener("change", safeAsync(async () => {
      if (!currentSettings) {
        return;
      }

      currentSettings.dataToRemove = removeInputs
        .filter((item) => item.checked)
        .map((item) => item.value);

      markSelfWrite();
      await CleanStartSettings.setDataToRemove(currentSettings.dataToRemove);
      updateSelectionSummary();
    }));
  });
  timePeriodInputs.forEach((input) => {
    input.addEventListener("change", safeAsync(async (event) => {
      if (!currentSettings) {
        return;
      }

      currentSettings.timePeriod = event.target.value;
      markSelfWrite();
      await CleanStartSettings.setTimePeriod(event.target.value);
      updateSelectionSummary();
    }));
  });

  updateStoreLink();
  loadSettingsIntoPopup().catch((error) => {
    console.warn("Clean Start popup init failed:", error?.message || error);
  });
})();
