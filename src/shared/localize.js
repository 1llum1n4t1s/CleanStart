(function initializeLocalize(global) {
  class Localize {
    apply() {
      document.querySelectorAll("[data-i18n]").forEach((element) => {
        const key = element.getAttribute("data-i18n");
        const message = chrome.i18n.getMessage(key);

        if (!message) {
          return;
        }

        element.textContent = message;
      });

      document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
        const key = element.getAttribute("data-i18n-placeholder");
        const message = chrome.i18n.getMessage(key);

        if (message) {
          element.setAttribute("placeholder", message);
        }
      });

      document.title = chrome.i18n.getMessage("app_name") || document.title;

      const uiLanguage = chrome.i18n.getUILanguage();
      if (uiLanguage) {
        document.documentElement.lang = uiLanguage;
      }
    }
  }

  global.Localize = Localize;
})(typeof globalThis !== "undefined" ? globalThis : this);

