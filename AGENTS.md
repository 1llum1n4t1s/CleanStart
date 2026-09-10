# AGENTS.md

このリポジトリのエージェント向け作業規約です。構造・責務・データフロー・設計判断は [DESIGN.md](DESIGN.md)、利用方法は [README.md](README.md) を参照してください。

## 開発と検証

CI に合わせる場合は Node.js 22 と pnpm 11 を使い、依存関係は `pnpm-lock.yaml` を正本とします。

```bash
pnpm install --frozen-lockfile             # lockfile に従うインストール
pnpm test                                 # Node 組み込みの全テスト
node --test tests/settings.test.js         # 単一ファイル
node --test --test-name-pattern="<名前>" tests/*.test.js
pnpm sync:support                         # 共通 JS/CSS を同期
pnpm sync:support --check                 # 書き換えずに正本との一致を検証
pnpm generate-icons                       # sharp で icons/ を生成
pnpm generate-screenshots                 # puppeteer でストア画像を生成
pnpm build                                # support 同期 + icons + screenshots
bash zip.sh                               # Git Bash + zip コマンドで配布 ZIP 作成
pwsh -NoProfile -File zip.ps1              # Windows で配布 ZIP 作成
```

- 初回準備は依存インストール後に `pnpm build` を実行します。拡張の動作確認は `chrome://extensions` の「パッケージ化されていない拡張機能を読み込む」でリポジトリ直下を指定し、編集後に拡張をリロードします。
- 実装変更後は `pnpm test` を実行します。テストは外部フレームワークやビルドを介さずソースを直接読みます。UI の表示・操作は実際のポップアップでも確認します。
- 共通サポート部品の正本は `@kagayoi/support-extension` です。同梱ファイルの直接改変は行わず、正本の package 更新後に `pnpm sync:support` で反映します。`pnpm sync:support --check` で JS 2 本・CSS 3 本の一致、`pnpm test` で組み込み契約を検証します。
- ZIP スクリプトと公開 CI は同梱済みの `src/` を梱包し、サポート同期を実行しません。共通部品の更新は梱包前に同期・検証します。`pnpm build` は追跡済みアイコンと ignored の `webstore/images/` を生成します。

## 変更時に維持する契約

- データ型を変更するときは `src/shared/settings.js` の `DATA_TYPES`、`DATA_TYPE_MESSAGE_KEYS`、`normalizeDataToRemove`、`STARTUP_RELOAD_DATA_TYPES`、既定選択を点検し、`popup.html` の checkbox value と `_locales/{en,ja}/messages.json` を揃えます。`cache` と `cacheStorage` は独立した選択肢として維持します。
- 期間を変更するときは `TIME_PERIODS`、`TIME_PERIOD_MESSAGE_KEYS`、`getSince`、既定値、ポップアップと翻訳を揃えます。
- Service Worker の共有処理は DOM 非依存の `settings.js` / `security.js` を使います。`localize.js` はポップアップで読み込みます。
- メッセージ処理の変更では送信元認可と保存設定による削除対象の決定を維持し、`tests/security.test.js` と `tests/background.test.js` で確認します。削除・再読み込みの並行性とエラー通知は [DESIGN.md](DESIGN.md#データフロー) に照合します。
- 権限と外部通信の変更時は [DESIGN.md](DESIGN.md#セキュリティと権限) の境界に照合し、manifest、問い合わせ契約、利用者向け説明とプライバシーポリシーの整合を確認します。
- バージョン更新の依頼時は `manifest.json` の `version` を正本として `package.json` と同期します。公開ブランチ名は `release/<manifest version>` に揃えます。
