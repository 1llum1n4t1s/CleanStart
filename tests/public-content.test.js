"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const { DATA_TYPES } = require("../src/shared/settings.js");

test("利用者向けページとストア画像のデータ種別数が実装と一致する", () => {
  assert.equal(DATA_TYPES.length, 10);

  for (const screenshot of [
    "webstore/01-feature-overview.html",
    "webstore/03-hero-promo.html",
    "webstore/05-promo-marquee.html"
  ]) {
    const html = read(screenshot);
    assert.match(html, new RegExp(`${DATA_TYPES.length}\\s*種`));
    assert.doesNotMatch(html, /12\s*種/);
  }
});

test("Chrome Web Store 原稿が問い合わせ通信と利用者データを開示する", () => {
  const listing = read("webstore/store-listing.txt");

  assert.match(listing, /support\.kagayoi\.com/);
  assert.match(listing, /support-session access token/);
  assert.match(listing, /サポートセッショントークン/);
  assert.match(listing, /Personally identifiable information collected\? Yes/);
  assert.match(listing, /個人を特定できる情報を収集しますか？[\s\S]*はい。/);
  assert.doesNotMatch(listing, /12 data types|12 種類/);
  assert.doesNotMatch(listing, /Local-only, zero network|外部サーバーと一切通信しません/);
});

test("プライバシーポリシーが保存先と自動削除を開示する", () => {
  const canonical = read("docs/privacy-policy.md");

  for (const content of [canonical]) {
    assert.match(content, /localStorage/);
    assert.match(content, /support access token|サポート用アクセストークン/i);
    assert.match(content, /automatic startup cleanup|起動時自動削除/i);
  }
});
