# Clean Start 設計

この文書は、現在のコード・設定・テストから確認できる Clean Start の設計正本です。利用方法は [README.md](README.md)、エージェント向けの作業規約と検証コマンドは [AGENTS.md](AGENTS.md) を参照してください。

## 目的と境界

Clean Start は Manifest V3 の Chrome 拡張機能で、現在の Chrome プロファイルに属する閲覧データを、利用者が選んだ種類と期間に従って削除します。削除は `chrome.browsingData` に委譲し、Cookie を個別列挙・管理する機能は持ちません。

通常の削除処理は拡張内部の Chrome API だけで完結します。拡張が利用者の入力データを API へ送る外部通信は、利用者が問い合わせフォームを操作したときの Kagayoi Support API に限定されます。

## 主要コンポーネント

| コンポーネント | 責務 |
| --- | --- |
| `manifest.json` | MV3 エントリ、権限、CSP、アイコン、ローカライズの宣言 |
| `popup.html` / `src/popup/` | 設定表示・変更、2段階の削除確認、Service Worker とのメッセージ通信 |
| `src/background/background.js` | 設定に基づく削除、起動時削除、HTTP(S) タブの再読み込み、エラーバッジ |
| `src/shared/settings.js` | 設定スキーマ、既定値、正規化、ストレージ入出力、削除対象・期間の変換 |
| `src/shared/security.js` | Service Worker が受け取るメッセージ送信元の認可 |
| `src/shared/localize.js` / `_locales/` | DOM の `data-i18n` とプレースホルダーへの翻訳適用 |
| `src/shared/kagayoi-support-*.js` | 問い合わせフォームとストア評価導線。Kagayoi.Support の共通部品を同梱 |
| `tests/` | 設定契約、送信元認可、i18n、問い合わせ部品と manifest の整合性を Node 組み込みテストで検証 |
| `scripts/` / `webstore/` | `sharp` によるアイコン生成と `puppeteer` によるストア画像生成 |
| `.github/workflows/publish.yml` | `release/<manifest version>` push 時の ZIP 作成と Chrome Web Store 公開 |

## 実行コンテキストと共有コード

拡張はポップアップと Service Worker の2つの実行コンテキストを持ちます。`src/shared/*.js` は IIFE で `globalThis` に公開しつつ CommonJS でも export するため、同じ実装を拡張ページ、`importScripts`、Node テストから利用できます。

`localize.js` は DOM に依存するためポップアップ専用です。Service Worker は DOM 非依存の `settings.js` と `security.js` だけを読み込みます。バンドラーは使わず、リポジトリ直下がそのまま拡張のロード単位です。

## 設定モデル

設定は `chrome.storage.local` に保存します。

| キー | 意味 | 既定値 |
| --- | --- | --- |
| `autorefresh` | 手動削除後に全 HTTP(S) タブを再読み込みするか | `false` |
| `clearonstartup` | Chrome 起動時に自動削除するか | `false` |
| `dataToRemove` | 削除対象の配列を JSON 文字列化した値 | `cache`, `cacheStorage`, `fileSystems`, `indexedDB` |
| `timePeriod` | `last_hour` / `last_day` / `last_week` / `last_month` / `everything` | `last_hour` |

`CleanStartSettings.DATA_TYPES` が削除対象データ型の単一の真実の源です。UI の checkbox、i18n キー、正規化、起動時リロード判定も同じキー集合へ連動します。未知の値は正規化時に除外し、不正な期間は `last_hour` へ戻します。`ensureDefaults` は不足キーだけを補う冪等処理で、`onInstalled` と `onStartup` の重複実行に耐えます。

## データフロー

### 設定変更

1. ポップアップが正規化済み設定を読み込み、チェックボックス・期間・要約を描画します。
2. 利用者の変更を `CleanStartSettings` の setter 経由で `chrome.storage.local` へ保存します。
3. ポップアップ自身の書き込み直後は storage change の再読込を短時間抑制し、外部変更だけを再描画へ反映します。

### 手動削除

1. Clear ボタンは `idle → confirming → busy` の2段階確認を経て、`clear-active-tab` メッセージを送ります。
2. Service Worker は送信元が自拡張の特権コンテキストであることを検証します。
3. Service Worker はメッセージの payload ではなく `chrome.storage.local` の現在設定を読みます。
4. 期間を `since` timestamp、対象配列を `{ type: true }` へ変換し、`chrome.browsingData.remove` を実行します。
5. `autorefresh` が有効なら、全 HTTP(S) タブを小さい batch に分けて再読み込みします。

同時に複数の削除要求が届いた場合は `inFlightClear` の同じ Promise を共有し、プロファイル全体への削除とタブ再読み込みの二重実行を防ぎます。Service Worker の cold start による配送失敗だけはポップアップ側で1回再試行し、処理継続中の可能性がある timeout は再送しません。

### 起動時削除

1. `onStartup` が既定値を補い、`clearonstartup` を確認します。
2. 有効なら自動リロードを一旦抑止して削除します。
3. 選択項目にキャッシュ・Cookie・サイト保存領域が含まれる場合だけ、セッション復元タブを待つ2段階の discovery 後に HTTP(S) タブを再読み込みします。

### エラー通知

Service Worker の削除失敗は赤い `!` バッジで残します。ポップアップを開いた時点を確認済みとみなしバッジを消し、開いたままの削除失敗はボタンの error 状態で伝えます。

### 問い合わせ

ポップアップの共通フッターから問い合わせダイアログを開き、メール認証後に `productId=clean-start` を付けて `https://support.kagayoi.com` へチケットを送信します。必要な host permission はこの通信先だけです。共通部品が読み込めない場合は Web の問い合わせ窓口へフォールバックします。

## セキュリティと権限

- Chrome API 権限は `storage`、`browsingData`、`tabs`。Cookie 削除に `cookies` 権限は使いません。
- host permission は Kagayoi Support の HTTPS origin だけです。
- Service Worker は `sender.id`、`sender.tab`、`sender.url` を検証し、他拡張・content script・Web origin からの削除要求を拒否します。
- 削除対象は受信メッセージから決めず、正規化した保存設定だけを信用します。
- 拡張ページの CSP はローカル script のみを許可し、外部 JavaScript や外部フォントを実行時に読み込みません。

## 採用済みの設計判断

- `browsingData` はプロファイル全体へ作用するため、手動削除後の再読み込み対象もアクティブタブではなく全 HTTP(S) タブにします。影響を抑えるため batch 間隔を設けます。
- 起動時はセッション復元が遅れるため、固定の単発 query ではなく時間を空けた2回の discovery を行います。代わりに起動時処理が数秒長くなります。
- 設定・セキュリティを純関数中心の共有モジュールへ分離し、Chrome API の薄い mock で直接テストできる構成にします。
- Kagayoi Support の部品は拡張ごとに分岐させず、権威ある共通実装を同梱して契約テストで同期を確認します。
- `manifest.json` の version を製品バージョンの正本とし、`package.json` と同期します。公開 workflow は release branch 名との一致を検証してから送信します。

## 検証と生成物

`pnpm test` は設定の境界値・異常値、prototype pollution 防止、ストレージエラー、送信元認可、i18n キー集合、Kagayoi Support 契約を検証します。`pnpm build` は配布に使う追跡済みアイコンと、Git では無視するストア画像を生成します。依存解決の再現性は `pnpm install --frozen-lockfile` で確認します。
