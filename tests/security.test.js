"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");

const CleanStartSecurity = require("../src/shared/security.js");

const RUNTIME_ID = "abcdefghijklmnopabcdefghijklmnop";

describe("isAuthorizedSender", () => {
  test("popup からの正常メッセージは通過", () => {
    const sender = {
      id: RUNTIME_ID,
      url: `chrome-extension://${RUNTIME_ID}/popup.html`
    };
    assert.equal(CleanStartSecurity.isAuthorizedSender(sender, RUNTIME_ID), true);
  });

  test("sender が null の場合は拒否", () => {
    assert.equal(CleanStartSecurity.isAuthorizedSender(null, RUNTIME_ID), false);
    assert.equal(CleanStartSecurity.isAuthorizedSender(undefined, RUNTIME_ID), false);
  });

  test("runtimeId が文字列でない場合は拒否（防御的）", () => {
    const sender = { id: RUNTIME_ID };
    assert.equal(CleanStartSecurity.isAuthorizedSender(sender, undefined), false);
    assert.equal(CleanStartSecurity.isAuthorizedSender(sender, null), false);
    assert.equal(CleanStartSecurity.isAuthorizedSender(sender, 123), false);
  });

  test("他拡張からの sender.id 不一致は拒否", () => {
    const sender = {
      id: "differentextensionidaaaaaaaaaaaa",
      url: "chrome-extension://differentextensionidaaaaaaaaaaaa/x.html"
    };
    assert.equal(CleanStartSecurity.isAuthorizedSender(sender, RUNTIME_ID), false);
  });

  test("content script (sender.tab あり) は拒否", () => {
    const sender = {
      id: RUNTIME_ID,
      tab: { id: 42, url: "https://evil.example.com" },
      url: "https://evil.example.com"
    };
    assert.equal(CleanStartSecurity.isAuthorizedSender(sender, RUNTIME_ID), false);
  });

  test("sender.url が chrome-extension:// 以外なら拒否", () => {
    const sender = {
      id: RUNTIME_ID,
      url: "https://evil.example.com/inject.html"
    };
    assert.equal(CleanStartSecurity.isAuthorizedSender(sender, RUNTIME_ID), false);
  });

  test("sender.url が undefined でも他条件が揃えば通過 (SW 自己送信を想定)", () => {
    const sender = { id: RUNTIME_ID };
    assert.equal(CleanStartSecurity.isAuthorizedSender(sender, RUNTIME_ID), true);
  });

  test("CleanStartSecurity オブジェクト自体が freeze", () => {
    assert.ok(Object.isFrozen(CleanStartSecurity));
    assert.throws(() => {
      CleanStartSecurity.isAuthorizedSender = () => true;
    });
  });
});
