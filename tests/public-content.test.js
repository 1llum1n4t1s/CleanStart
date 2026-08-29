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

  const landingPage = read("web/index.html");
  assert.match(landingPage, new RegExp(`${DATA_TYPES.length} 種類`));
  assert.doesNotMatch(landingPage, /12 種類|Web SQL|App Cache/);

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

test("英語プライバシーポリシーの API と権限説明が文章として完結する", () => {
  const privacy = read("web/privacy.html");
  const canonical = read("docs/privacy-policy.md");

  assert.match(
    privacy,
    /chrome\.browsingData\.remove<\/code> — deleting history, cache, cookies, and site data/
  );
  assert.match(
    privacy,
    /<strong>browsingData<\/strong>: Used to delete Chrome data based on the user's selected data types and time range\./
  );
  assert.match(
    privacy,
    /<strong>tabs<\/strong>: Used to enumerate open HTTP\/HTTPS tabs and reload them \(1\) after a manual Clear operation[\s\S]*\(2\) after an automatic startup cleanup/
  );
  for (const content of [canonical, privacy]) {
    assert.match(content, /localStorage/);
    assert.match(content, /support access token|サポート用アクセストークン/i);
    assert.match(content, /automatic startup cleanup|起動時自動削除/i);
  }
  assert.doesNotMatch(privacy, /<p>site data<\/p>|<p>cleanup \(optional feature\)<\/p>|<p>service worker<\/p>/);
  assert.doesNotMatch(privacy, /\*\*Last updated|<p[^>]*>---<\/p>/);
});
