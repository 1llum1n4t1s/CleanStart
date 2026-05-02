(function initializeCleanStartSecurity(global) {
  // chrome.runtime.onMessage の sender が自拡張の特権コンテキスト
  // (popup / options / SW 自身) かを判定する。
  //
  // 通過条件:
  //   1. sender が存在する
  //   2. sender.id が自拡張の runtime.id と一致 (他拡張の弾き)
  //   3. sender.tab が存在しない (content script の弾き)
  //   4. sender.url が chrome-extension:// で始まる (将来の web_accessible 経由攻撃の弾き)
  //
  // 4 は将来 content script や web_accessible_resources を追加した際の保険。
  // 現状は 1-3 で十分だが、コメント依存でなく構造ガードに昇格させる。
  function isAuthorizedSender(sender, runtimeId) {
    if (!sender || typeof runtimeId !== "string") {
      return false;
    }
    if (sender.id !== runtimeId) {
      return false;
    }
    if (sender.tab) {
      return false;
    }
    if (typeof sender.url === "string" && !sender.url.startsWith("chrome-extension://")) {
      return false;
    }
    return true;
  }

  const CleanStartSecurity = Object.freeze({
    isAuthorizedSender
  });

  global.CleanStartSecurity = CleanStartSecurity;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = CleanStartSecurity;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
