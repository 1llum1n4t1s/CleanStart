# Privacy Policy / プライバシーポリシー — Clean Start

**Last updated / 最終更新日:** 2026-08-27

---

## English

### Introduction

"Clean Start" (the "Extension") respects your privacy and is committed
to protecting your information. This privacy policy explains how the
Extension handles data.

### Data we collect

The Extension collects **no** personal information on its own. There is
no tracking, no analytics, and no telemetry of any kind. Your email
address and name are received only when you type them into the contact
form and submit it (see "Contact form").

### Data stored locally

The Extension stores the following preference values inside your browser
only (`chrome.storage.local`):

- Whether to auto-reload all HTTP tabs after a clear (`autorefresh`)
- Whether to run an automatic cleanup at Chrome startup (`clearonstartup`)
- The list of data types selected for deletion (`dataToRemove`)
- The selected deletion time range (`timePeriod`)

These values stay on your device and are **never** transmitted to any
external server.

### Data sharing

The Extension does not share any data with any third party. Contact form
content goes to the developer's (Kagayoi) support desk and is never
passed to advertising or analytics third parties.

### Contact form

Only when you press "Contact support" in the popup and submit the form
does the Extension send the following to Kagayoi Support
(`https://support.kagayoi.com`). No such request happens unless you
press the button.

- The email address, optional name, inquiry category, subject, and
  message you entered
- Product ID, extension version, and locale

On first use, the six-digit code delivered by email is sent to Kagayoi
Support to verify you. After verification, Kagayoi Support stores the
inquiry and replies so that you and support staff can access them. Your
cleanup settings, browsing history, and tab URLs are never sent.

### Network communication

Apart from the contact form above, the Extension does not communicate
with any external server.

All cleanup operations are performed locally through the following
Chrome standard APIs:

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
- **tabs**: Used to enumerate open HTTP/HTTPS tabs and reload them
  right after a Clear operation, only when the user has enabled
  "Reload all HTTP tabs after clearing". Tab URLs and titles are read
  only to filter HTTP/HTTPS targets; they are never logged, stored,
  or transmitted anywhere.

### Host permissions

The Extension requests exactly one host permission,
`https://support.kagayoi.com/*`, used only to submit the contact form.
No broad host permission such as `<all_urls>` is requested.

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

本拡張機能が自動的に個人情報を収集することはありません。トラッキング、解析、テレメトリのいずれも行いません。メールアドレスとお名前は、利用者がお問い合わせフォームに入力して送信したときだけ受け取ります（「お問い合わせフォーム」の項を参照）。

### ローカルに保存するデータ

本拡張機能は、以下の設定データをユーザーの端末内（`chrome.storage.local`）にのみ保存します。

- 削除後に全 HTTP タブを自動再読み込みするかどうかのフラグ（`autorefresh`）
- Chrome 起動時に自動削除を実行するかどうかのフラグ（`clearonstartup`）
- 削除対象データ型のリスト（`dataToRemove`）
- 削除対象期間（`timePeriod`）

これらのデータは端末内にのみ保存され、外部サーバーへの送信は一切行いません。

### データの共有

本拡張機能は、いかなるデータも第三者と共有しません。お問い合わせの内容は開発者（Kagayoi）のサポート窓口が受け取るもので、広告・解析目的の第三者へ渡すことはありません。

### お問い合わせフォーム

ポップアップの「お問い合わせ」ボタンから送信したときだけ、次の情報を Kagayoi Support（`https://support.kagayoi.com`）へ送信します。ボタンを押さない限り、この通信は発生しません。

- 入力されたメールアドレス、お名前（任意）、問い合わせ種別、件名、本文
- 製品ID、拡張機能のバージョン、ロケール

初回はメールで届く6桁の確認コードを Kagayoi Support へ送信して本人確認します。認証後の問い合わせと返信は、利用者本人とサポート担当者が確認できるよう Kagayoi Support に保存します。削除設定、閲覧履歴、タブの URL は送信しません。

### ネットワーク通信

本拡張機能は、上記のお問い合わせフォームを除き、外部サーバーとの通信を行いません。

削除の処理は、以下の Chrome 標準 API を介してブラウザ内のみで完結します。

- `chrome.storage.local` — 設定値のローカル保存
- `chrome.browsingData.remove` — 履歴、キャッシュ、Cookie、サイト保存データの削除
- `chrome.tabs.query` / `chrome.tabs.reload` — 削除後のタブ再読み込み（任意機能）
- `chrome.runtime` — 拡張機能内部のメッセージング（popup ↔ background）

### 権限の使用目的

- **storage**: 上記のローカル設定値を保存・読み出すために使用します。
- **browsingData**: ユーザーが選択した期間・データ型に基づいて Chrome のデータを削除するために使用します。本拡張機能の中核機能です。
- **tabs**: ユーザーが「削除後に全 HTTP タブを再読み込み」を有効にした場合、開いている HTTP/HTTPS タブを列挙して Clear 操作直後に再読み込みするために使用します。タブの URL やタイトルは HTTP/HTTPS フィルタのために参照するのみで、ログ出力・保存・外部送信は一切行いません。

### ホスト権限について

本拡張機能が要求する `host_permissions` は `https://support.kagayoi.com/*` の 1 つだけで、お問い合わせの送信にのみ使います（`<all_urls>` などの広いホスト権限はありません）。

### リモートコードの読み込み

本拡張機能は、外部からのコード読み込みを一切行いません。Content Security Policy で `script-src 'self'; object-src 'self'` を明示し、リモートスクリプトの実行を不可能にしています。

### お問い合わせ

本プライバシーポリシーに関するご質問は、Chrome Web Store のサポートページよりお問い合わせください。

### 変更について

本プライバシーポリシーは予告なく変更される場合があります。変更があった場合は、本ページを更新します。
