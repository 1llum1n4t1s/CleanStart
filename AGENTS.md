# CLAUDE.md

This file provides guidance to Claude Code and other coding agents working in this repository.

## 概要

Clean Start は MV3 の Chrome 拡張機能。ポップアップから `chrome.browsingData` で履歴・キャッシュ・Cookie・各種サイト保存データをワンクリック削除する。`host_permissions` / `cookies` 権限は要求せず、`storage` / `browsingData` / `tabs` の 3 権限のみで動く（[manifest.json](manifest.json)）。

## 主要コマンド

```bash
pnpm test                                  # 全テスト (node --test tests/*.test.js)
node --test tests/settings.test.js         # 単一ファイルのテスト
node --test --test-name-pattern="<名前>"   # 名前で 1 テストだけ実行
pnpm generate-icons                        # sharp で icons/ を生成
pnpm generate-screenshots                  # puppeteer で webstore スクショ生成
pnpm build                                 # icons + screenshots を両方生成
bash zip.sh                                # 配布 zip (Git Bash + zip コマンド)
powershell -ExecutionPolicy Bypass -File zip.ps1   # zip コマンドが無い Windows 用
```

- テストランナーは **Node 組み込み** (`node --test`)。外部フレームワーク・ビルドステップ無しでソースをそのまま読む。
- 拡張のロードは `chrome://extensions` →「パッケージ化されていない拡張機能を読み込む」でリポジトリ直下（`manifest.json` がルートにある）を指定する。バンドラは無いので編集後はリロードだけで反映。
- パッケージ操作は pnpm を使う（`pnpm-lock.yaml`）。README 内の `npm install` / `npm ci` / `package-lock.json` の記述は移行前の名残なので pnpm 系コマンドに読み替える。

## アーキテクチャ（複数ファイルにまたがる勘所）

### 3 つの実行コンテキストと共有モジュールのロード方式

`src/shared/*.js` は全て **IIFE で `globalThis` に名前付きオブジェクトを生やしつつ、末尾で `module.exports` も兼ねる** 二重エクスポート形式。これにより同一ソースが 3 経路でロードされる：

| コンテキスト | エントリ | shared のロード方法 |
|---|---|---|
| Service Worker | [src/background/background.js](src/background/background.js) | `importScripts("../shared/settings.js" / "security.js")` |
| ポップアップ | [src/popup/popup.js](src/popup/popup.js) | `popup.html` の `<script>` で settings.js + localize.js |
| Node テスト | `tests/*.test.js` | `require()`（[tests/chrome-mock.js](tests/chrome-mock.js) の `loadFreshSettings` が require.cache を破棄して都度リロード）|

**注意：[src/shared/localize.js](src/shared/localize.js) は `document` 依存なので SW からは importScripts しない**（apply() 内に noop ガードはあるが popup/options 専用）。SW で共有ロジックが要るときは settings.js / security.js を使う。

### データ型の単一の真実の源

`CleanStartSettings.DATA_TYPES`（[settings.js:4](src/shared/settings.js)）が削除対象データ型の正本。下記が全てこのリストにキー連動している：

- `DATA_TYPE_MESSAGE_KEYS` … 各型 → i18n キー
- `STARTUP_RELOAD_DATA_TYPES` … 削除後にタブリロードが要る型の部分集合
- `normalizeDataToRemove` … 未知の値を捨てる際のフィルタ
- `popup.html` の各チェックボックスの `value` 属性
- `_locales/{en,ja}/messages.json` の `options_remove_*` メッセージ

**データ型を増減するときはこの 5 箇所＋必要なら `STARTUP_RELOAD_DATA_TYPES` / デフォルト選択（`DEFAULT_RAW_SETTINGS.dataToRemove`）を同時に揃える**。`cache`（HTTP キャッシュ）と `cacheStorage`（Cache Storage API / PWA）は別物として両方提供している点に注意。

### 削除フロー

設定 → `toRemoveObject(dataToRemove)` が `{ type: true, ... }` を構築 → `getSince(timePeriod)` が期間を timestamp 化 → `chrome.browsingData.remove({ since }, removeObject)`（[background.js:150-172](src/background/background.js)）。設定は `chrome.storage.local` に生値（`dataToRemove` は JSON 文字列）で保存し、読み出し時に `normalizeSettings` で正規化する。`ensureDefaults` は onInstalled / onStartup の二重発火に耐える冪等処理。

### タブリロードの 2 系統

- **手動クリア後**（autorefresh ON）→ `reloadAllTabs`：全 HTTP タブを即リロード。browsingData はプロファイル全体を消すため、アクティブタブだけでは他タブが古いキャッシュ参照のままになるのを避ける設計。
- **Chrome 起動時クリア後** → `reloadStartupTabs`：1200ms / 2500ms の 2 回に分けてタブを discovery（セッション復元タブの取りこぼし防止）、バッチ実行。`reloadStartupTabsRunning` で並走ガード。選択データ型が `STARTUP_RELOAD_DATA_TYPES` に含まれる場合のみ走る。

### セキュリティ / メッセージ境界

`chrome.runtime.onMessage` は [src/shared/security.js](src/shared/security.js) の純関数 `isAuthorizedSender` でガード（自拡張の特権コンテキスト＝popup/options/SW のみ通す）。background は `message.tab` を信用せず、削除対象を `chrome.storage` の設定だけから決める（browsingData はプロファイル全体に効くため送信元タブの情報は使わない）。純関数化はテスト可能性のため（[tests/security.test.js](tests/security.test.js)）。

### エラー UX の対称契約

SW 側でクリア失敗時 `showErrorBadge()` が赤い「!」バッジを出し、popup を開いた瞬間 `clearActionBadge()` が消す（= ユーザーが気付いた acknowledge とみなす）。popup を開かないユーザーが異常に永久に気付けない問題への対策。

## バージョン管理

`manifest.json` の `version` が正式バージョン。`package.json` も同期する。バージョン更新は明示指示（`/vava` 等）があるときだけ行う。
