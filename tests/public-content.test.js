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

  // ストア画像の文言は webstore/store-assets.json（vitrina 設定）が正本。ヒーローのチップに種別数が入る。
  const config = JSON.parse(read("webstore/store-assets.json"));
  const hero = config.slides.find((slide) => slide.layout === "hero");
  const chip = hero.chips[0];
  assert.match(chip.en, new RegExp(`^${DATA_TYPES.length}\\s`));
  assert.match(chip.ja, new RegExp(`^${DATA_TYPES.length}種`));
  for (const text of Object.values(chip)) {
    assert.doesNotMatch(text, /12\s*(種|kinds)/);
  }
});

test("Chrome Web Store 原稿が問い合わせ通信と利用者データを開示する", () => {
  const listing = read("webstore/store-listing.txt");

  assert.match(listing, /support\.kagayoi\.com/);
  assert.match(listing, /support-session access token/);
  assert.match(listing, /サポートセッショントークン/);
  // 掲載情報の「データの使用に関する開示」は、収集する種類のチェック項目として個人を特定できる情報を挙げる。
  assert.match(listing, /Data types collected \(checked\):[\s\S]*?Personally identifiable information/);
  assert.match(listing, /収集するデータの種類（チェックを入れるもの）:[\s\S]*?個人を特定できる情報/);
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
