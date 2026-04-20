(function initializeOptionsPage() {
  const main = document.getElementById("main");
  const autorefresh = document.getElementById("autorefresh");
  const clearOnStartup = document.getElementById("clearonstartup");
  const clearOnStartupWarning = document.getElementById("clearonstartup-warning");
  const removeInputs = Array.from(document.querySelectorAll("#remove-list input[type='checkbox']"));
  const timePeriodInputs = Array.from(document.querySelectorAll("#time-period input[type='radio']"));

  let currentSettings = null;

  function safeAsync(handler) {
    return (event) => {
      Promise.resolve(handler(event)).catch((error) => {
        console.warn("Clean Start handler failed:", error?.message || error);
      });
    };
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

    for (const input of removeInputs) {
      input.checked = settings.dataToRemove.includes(input.value);
    }

    for (const input of timePeriodInputs) {
      input.checked = input.value === settings.timePeriod;
    }

    main.classList.remove("hidden");
  }

  async function handleDataToRemoveChange() {
    if (!currentSettings) {
      return;
    }

    const selectedItems = removeInputs
      .filter((input) => input.checked)
      .map((input) => input.value);

    currentSettings.dataToRemove = selectedItems;
    await CleanStartSettings.setDataToRemove(selectedItems);
  }

  async function handleTimePeriodChange(event) {
    if (!currentSettings) {
      return;
    }

    currentSettings.timePeriod = event.target.value;
    await CleanStartSettings.setTimePeriod(event.target.value);
  }

  async function loadSettingsIntoPage() {
    // background SW の onInstalled で ensureDefaults() 済み。options は load() のみ。
    const settings = await CleanStartSettings.load();
    render(settings);
  }

  const localization = new Localize();
  localization.apply();

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
    input.addEventListener("change", safeAsync(handleDataToRemoveChange));
  });

  timePeriodInputs.forEach((input) => {
    input.addEventListener("change", safeAsync(handleTimePeriodChange));
  });

  loadSettingsIntoPage().catch((error) => {
    console.warn("Clean Start options init failed:", error?.message || error);
  });
})();
