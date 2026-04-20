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

  const labels = {
    idle: chrome.i18n.getMessage("popup_clear") || "Clear",
    busy: chrome.i18n.getMessage("popup_clearing") || "Clearing...",
    done: chrome.i18n.getMessage("popup_clean") || "Done"
  };

  const timePeriodLabelMap = Object.freeze({
    last_hour: "options_last_hour",
    last_day: "options_last_day",
    last_week: "options_last_week",
    last_month: "options_last_month",
    everything: "options_everything"
  });

  let currentSettings = null;

  function getLabel(messageKey, fallback) {
    return chrome.i18n.getMessage(messageKey) || fallback;
  }

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
    const timeKey = timePeriodLabelMap[currentSettings.timePeriod];
    periodChip.textContent = getLabel(timeKey, currentSettings.timePeriod);

    selectionTags.innerHTML = "";

    if (currentSettings.dataToRemove.length === 0) {
      selectionTags.appendChild(
        createSelectionChip(
          chrome.i18n.getMessage("popup_nothing_selected") || "Nothing selected",
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

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
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

  function updateStoreLink() {
    const storeLink = document.querySelector(".teaser");
    const updateUrl = chrome.runtime.getManifest().update_url?.toLowerCase();
    const extensionId = chrome.runtime.id;
    const href = updateUrl && updateUrl.includes("microsoft")
      ? "https://microsoftedge.microsoft.com/addons/detail/" + extensionId
      : "https://chrome.google.com/webstore/detail/" + extensionId;

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
      clearLabel.textContent = chrome.i18n.getMessage("popup_confirm")
        || "Tap again to clear";
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

  const localization = new Localize();
  localization.apply();
  setClearButtonStateExtended("idle");

  clearButton.addEventListener("click", safeAsync(handleClearClick));
  autorefresh.addEventListener("change", safeAsync(async (event) => {
    if (!currentSettings) {
      return;
    }

    currentSettings.autorefresh = event.target.checked;
    await CleanStartSettings.setFlag("autorefresh", event.target.checked);
  }));
  clearOnStartup.addEventListener("change", safeAsync(async (event) => {
    if (!currentSettings) {
      return;
    }

    currentSettings.clearonstartup = event.target.checked;
    updateClearOnStartupWarning();
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
      await CleanStartSettings.setTimePeriod(event.target.value);
      updateSelectionSummary();
    }));
  });

  updateStoreLink();
  loadSettingsIntoPopup().catch((error) => {
    console.warn("Clean Start popup init failed:", error?.message || error);
  });
})();
