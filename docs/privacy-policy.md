# Privacy Policy / プライバシーポリシー — Clean Start

**Last updated / 最終更新日:** 2026-04-21

---

## English

### Introduction

"Clean Start" (the "Extension") respects your privacy and is committed
to protecting your information. This privacy policy explains how the
Extension handles data.

### Data we collect

The Extension does **not** collect any personal information. There is
no tracking, no analytics, and no telemetry of any kind.

### Data stored locally

The Extension stores the following preference values inside your browser
only (`chrome.storage.local`):

- Whether to auto-reload the active tab after a clear (`autorefresh`)
- Whether to run an automatic cleanup at Chrome startup (`clearonstartup`)
- The list of data types selected for deletion (`dataToRemove`)
- The selected deletion time range (`timePeriod`)

These values stay on your device and are **never** transmitted to any
external server.

### Data sharing

The Extension does not share any data with any third party.

### Network communication

The Extension does not communicate with any external server.

All operations are performed locally through the following Chrome
standard APIs:

- `chrome.storage.local` — storing settings locally
- `chrome.browsingData.remove` — deleting history, cache, cookies, and
  site data
- `chrome.tabs.query` / `chrome.tabs.reload` — reloading tabs after a
  cleanup (optional feature)
- `chrome.runtime` — internal messaging between popup and background
  service worker

### Permission justifications

- **storage**: Used to read and write the local settings listed above.
- **browsingData**: Used to delete Chrome data based on the user's
  selected data types and time range. This is the core function of the
  Extension.
- **activeTab**: Used to reload the active tab right after a Clear
  operation, only when the user has enabled "Reload the active tab
  after clearing". Never used to monitor or inspect background tabs.

### Host permissions

The Extension does **not** request any `host_permissions`. No broad
host permission such as `<all_urls>` is requested.

### Remote code

The Extension does not load any code from external sources. The
Content Security Policy is set explicitly to
`script-src 'self'; object-src 'self'`, making remote script execution
impossible.

### Contact

For questions regarding this privacy policy, please contact us via the
Chrome Web Store support page.

### Changes

This privacy policy may be updated without notice. Any changes will be
reflected on this page.

---

## 日本語 (Japanese)

### はじめに

「Clean Start」（以下「本拡張機能」）は、ユーザーのプライバシーを尊重し、個人情報の保護に努めます。本プライバシーポリシーは、本拡張機能におけるデータの取り扱いについて説明します。

### 収集するデータ

本拡張機能は、個人情報を一切収集しません。トラッキング、解析、テレメトリのいずれも行いません。

### ローカルに保存するデータ

本拡張機能は、以下の設定データをユーザーの端末内（`chrome.storage.local`）にのみ保存します。

- 削除後にアクティブタブを自動再読み込みするかどうかのフラグ（`autorefresh`）
- Chrome 起動時に自動削除を実行するかどうかのフラグ（`clearonstartup`）
- 削除対象データ型のリスト（`dataToRemove`）
- 削除対象期間（`timePeriod`）

これらのデータは端末内にのみ保存され、外部サーバーへの送信は一切行いません。

### データの共有

本拡張機能は、いかなるデータも第三者と共有しません。

### ネットワーク通信

本拡張機能は、外部サーバーとの通信を一切行いません。

すべての処理は、以下の Chrome 標準 API を介してブラウザ内のみで完結します。

- `chrome.storage.local` — 設定値のローカル保存
- `chrome.browsingData.remove` — 履歴、キャッシュ、Cookie、サイト保存データの削除
- `chrome.tabs.query` / `chrome.tabs.reload` — 削除後のタブ再読み込み（任意機能）
- `chrome.runtime` — 拡張機能内部のメッセージング（popup ↔ background）

### 権限の使用目的

- **storage**: 上記のローカル設定値を保存・読み出すために使用します。
- **browsingData**: ユーザーが選択した期間・データ型に基づいて Chrome のデータを削除するために使用します。本拡張機能の中核機能です。
- **activeTab**: ユーザーが「削除後にアクティブタブを再読み込み」を有効にした場合、Clear 操作直後にアクティブタブを再読み込みするために使用します。バックグラウンドで他タブを監視・操作するためには使用しません。

### ホスト権限について

本拡張機能は `host_permissions` を一切要求しません（`<all_urls>` などの広いホスト権限はありません）。

### リモートコードの読み込み

本拡張機能は、外部からのコード読み込みを一切行いません。Content Security Policy で `script-src 'self'; object-src 'self'` を明示し、リモートスクリプトの実行を不可能にしています。

### お問い合わせ

本プライバシーポリシーに関するご質問は、Chrome Web Store のサポートページよりお問い合わせください。

### 変更について

本プライバシーポリシーは予告なく変更される場合があります。変更があった場合は、本ページを更新します。
