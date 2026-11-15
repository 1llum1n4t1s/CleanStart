// <html lang> を同期で合わせる。Kagayoi フッター（module script）が最寄りの lang を読む前に確定させる。
Localizer.applyDocumentLang();

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
  const settingsError = document.getElementById("settings-error");
  const settingsInputs = [autorefresh, clearOnStartup, ...removeInputs, ...timePeriodInputs];

  let currentSettings = null;
  let settingsReady = false;
  let settingsSavePending = false;

  function updateControlAvailability() {
    const disabled = !settingsReady || settingsSavePending || clearButton.dataset.state === "busy";
    clearButton.disabled = disabled;
    settingsInputs.forEach((input) => { input.disabled = disabled; });
  }

  // 文言は共通モジュール Localizer 経由で引く（選択言語 → ブラウザ言語 → 英語 fallback）。
  function getLabel(messageKey, fallback) {
    return Localizer.t(messageKey, undefined, fallback);
  }

  // Localizer.ready の後（init）で getLabel から作る。選択言語の辞書が入る前に固定しないため。
  let labels = {};
  function buildLabels() {
    labels = {
      idle: getLabel("popup_clear", "Clear"),
      busy: getLabel("popup_clearing", "Clearing..."),
      done: getLabel("popup_clean", "Done"),
      error: getLabel("popup_clear_failed", "Failed - tap to retry")
    };
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
    settingsReady = true;
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
    updateControlAvailability();
  }

  async function saveSettings(write) {
    if (!settingsReady || settingsSavePending || clearButton.dataset.state === "busy") {
      return;
    }

    settingsSavePending = true;
    cancelConfirmTimer();
    setClearButtonStateExtended("idle");
    let failed = false;
    try {
      markSelfWrite();
      await write();
    } catch (error) {
      failed = true;
      console.warn("Clean Start settings save failed:", error?.message || error);
    }

    // 成否にかかわらず保存値を読み直し、表示と実際の削除対象を一致させる。
    try {
      await loadSettingsIntoPopup();
    } catch (error) {
      failed = true;
      console.warn("Clean Start settings reload failed:", error?.message || error);
    } finally {
      settingsError.hidden = !failed;
      settingsSavePending = false;
      updateControlAvailability();
    }
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
  // browsingData.remove とその後の全タブリロードはプロファイル規模次第で
  // 数十秒かかるため、タイムアウトは「固着回避の最終手段」として十分長く取る。
  // 短くすると、成功しつつある削除を失敗として表示してしまう。
  const SEND_MESSAGE_TIMEOUT_MS = 120000;

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
    // SW cold-start 中で「配送そのものが失敗した」と判るエラーだけリトライする。
    // timeout は配送に成功して SW 側で処理が継続している可能性があり、
    // 再送すると browsingData.remove と全タブリロードが二重に走るため含めない。
    const retryablePatterns = [
      "Could not establish connection",
      "message port was closed",
      "Receiving end does not exist"
    ];
    const message_str = typeof first?.error === "string" ? first.error : "";
    if (!retryablePatterns.some((p) => message_str.includes(p))) {
      return first;
    }
    await new Promise((r) => setTimeout(r, 500));
    return sendRuntimeMessageOnce(message);
  }

  // ---- 2 段階 Clear UI ----
  // idle → confirming（5秒タイマー）→ もう一度押せば busy → done → idle
  const CONFIRM_TIMEOUT_MS = 5000;
  let confirmTimeoutId = null;

  function setClearButtonStateExtended(state) {
    clearButton.dataset.state = state;
    updateControlAvailability();

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
        // idle へ戻すと成功と区別が付かない。error 状態を残してユーザーに失敗を伝える。
        // SW 側の showErrorBadge は popup を開いた時点で消える契約のため、
        // popup を開いたまま失敗したケースはここでしか気付けない。
        console.warn("Clean Start clear failed:", result?.error || "Unknown error");
        setClearButtonStateExtended("error");
        return;
      }

      setClearButtonStateExtended("done");
      window.setTimeout(() => setClearButtonStateExtended("idle"), CLEAR_DONE_DISPLAY_MS);
    } catch (error) {
      console.warn("Clean Start clear failed:", error?.message || error);
      setClearButtonStateExtended("error");
    }
  }

  async function handleClearClick() {
    if (!settingsReady || settingsSavePending) {
      return;
    }
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
    try {
      const settings = await CleanStartSettings.load();
      render(settings);
    } catch (error) {
      settingsReady = false;
      settingsError.hidden = false;
      updateControlAvailability();
      throw error;
    }
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
    if (settingsSavePending || Date.now() < selfWriteSuppressUntil) {
      return;
    }
    loadSettingsIntoPopup().catch((error) => {
      console.warn("Clean Start storage sync failed:", error?.message || error);
    });
  }

  async function initLocalization() {
    // 保存済みの選択言語の読み込みと chrome.i18n.getMessage の差し替えを待つ。
    await Localizer.ready;
    await Localizer.ensureFresh();
    Localizer.localizeDocument();
    // 言語切替 UI。変更時は Localizer が location.reload() で全体へ反映する。
    Localizer.mountLanguageSelect(document.getElementById("uiLanguage"));
    buildLabels();
  }

  // 同期の初回描画。ネイティブの getMessage（ブラウザ言語）で仮表示し、init 後に選択言語へ更新する。
  buildLabels();
  setClearButtonStateExtended("idle");
  // SW がセットしたエラーバッジ (!) を popup 起動時に消す。
  // background.js:showErrorBadge との対称契約。
  clearActionBadge();
  chrome.storage.onChanged.addListener(handleStorageChange);

  clearButton.addEventListener("click", safeAsync(handleClearClick));
  autorefresh.addEventListener("change", safeAsync(async (event) => {
    const value = event.target.checked;
    await saveSettings(() => CleanStartSettings.setFlag("autorefresh", value));
  }));
  clearOnStartup.addEventListener("change", safeAsync(async (event) => {
    const value = event.target.checked;
    await saveSettings(() => CleanStartSettings.setFlag("clearonstartup", value));
  }));
  removeInputs.forEach((input) => {
    input.addEventListener("change", safeAsync(async () => {
      const value = removeInputs
        .filter((item) => item.checked)
        .map((item) => item.value);

      await saveSettings(() => CleanStartSettings.setDataToRemove(value));
    }));
  });
  timePeriodInputs.forEach((input) => {
    input.addEventListener("change", safeAsync(async (event) => {
      const value = event.target.value;
      await saveSettings(() => CleanStartSettings.setTimePeriod(value));
    }));
  });

  // お問い合わせ / 評価ボタンとストア URL の解決は <kagayoi-support-footer> が自前で行う。
  // 文言の初期化が済んでから設定を描画し、ボタン文言・チップを選択言語で出す。
  initLocalization()
    .catch((error) => {
      console.warn("Clean Start localization init failed:", error?.message || error);
      buildLabels();
    })
    .then(() => {
      setClearButtonStateExtended("idle");
      return loadSettingsIntoPopup();
    })
    .catch((error) => {
      console.warn("Clean Start popup init failed:", error?.message || error);
    });
})();
