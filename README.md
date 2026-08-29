# Clean Start

履歴、キャッシュ、Cookie、各種サイト保存データを、ポップアップからまとめて削除できる Chrome 拡張機能です。

## できること

- ポップアップから履歴、キャッシュ、Cookie、各種サイト保存データを削除
- ポップアップ内で削除対象設定をそのまま確認、変更できる
- 削除対象期間を `Last Hour` から `Everything` まで選択
- 誤クリック防止: Clear ボタンは 2 段階タップ（一度押すと「もう一度タップで削除」状態になり、5 秒以内の 2 回目押下で実行）
- Chrome 起動時に自動削除を実行し、その後は通常の Web タブを順次リロード
- 必要に応じて削除後に全 HTTP タブを自動再読み込み
- ポップアップから任意で Kagayoi Support へ問い合わせ

## 構成

- `manifest.json`
- `popup.html`
- `src/background`
- `src/popup`
- `src/shared`
- `icons`
- `scripts`
- `docs`
- `webstore`
- `tests`

## 開発メモ

```bash
pnpm install --frozen-lockfile
pnpm build
```

テストは `pnpm test` で実行できます。依存関係は `pnpm-lock.yaml` を正本とし、CI 相当のインストールでは `pnpm install --frozen-lockfile` を使用します。詳しい作業規約と設計は [AGENTS.md](AGENTS.md) と [DESIGN.md](DESIGN.md) を参照してください。

PowerShell では以下で配布用 ZIP を作成できます。

```powershell
pwsh -NoProfile -File zip.ps1
```

## 補足

- Cookie はサイト全体の一括削除のみを行います（ドメイン指定削除はサポートしません）。
- `cookies` 権限は要求せず、Cookie を含むサイトデータの削除には `browsingData` API を使います。`host_permissions` は、利用者が問い合わせフォームを送信するときに使う `https://support.kagayoi.com/*` だけです。
- 現在のラインナップでは、実効性の低い `passwords` と `pluginData` を外し、実利用で影響が分かりやすい `cacheStorage` と `serviceWorkers` を追加しています。
