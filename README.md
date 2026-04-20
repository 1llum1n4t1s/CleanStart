# Clean Start

`C:\Users\szk\Work\CleanReload` の構成を参考にしつつ、ローカル拡張 `fidcileobejjkcaoalcnedmgmnegmoic` の機能と画面構成をベースに再実装した Chrome 拡張機能です。

## できること

- ポップアップから履歴、キャッシュ、Cookie、各種サイト保存データを削除
- ポップアップ内で削除対象設定をそのまま確認、変更できる
- 削除対象期間を `Last Hour` から `Everything` まで選択
- 誤クリック防止: Clear ボタンは 2 段階タップ（一度押すと「もう一度タップで削除」状態になり、5 秒以内の 2 回目押下で実行）
- Chrome 起動時に自動削除を実行し、その後は通常の Web タブを順次リロード
- 必要に応じて削除後にアクティブタブを自動再読み込み

## 構成

- `manifest.json`
- `popup.html`
- `options.html`
- `src/background`
- `src/popup`
- `src/options`
- `src/shared`
- `icons`
- `scripts`
- `docs`
- `webstore`

## 開発メモ

```bash
npm install
npm run build
```

CI 環境では再現性確保のため `npm ci` を使用してください（`package-lock.json` を尊重した厳密インストール）。

PowerShell では以下で配布用 ZIP を作成できます。

```powershell
powershell -ExecutionPolicy Bypass -File zip.ps1
```

## 補足

- Cookie はサイト全体の一括削除のみを行います（ドメイン指定削除はサポートしません）。
- `host_permissions` および `cookies` 権限は要求しません。`browsingData` のみで Cookie 含むサイトデータを削除します。
- 現在のラインナップでは、実効性の低い `passwords` と `pluginData` を外し、実利用で影響が分かりやすい `cacheStorage` と `serviceWorkers` を追加しています。
