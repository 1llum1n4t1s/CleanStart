# AGENTS.md

このリポジトリのエージェント向け作業規約です。構造・責務・データフロー・設計判断は [DESIGN.md](DESIGN.md)、利用方法は [README.md](README.md) を参照してください。

Bun は `package.json` の `packageManager` (`bun@1.4.4`) を正本とする。`bunfig.toml` の `minimumReleaseAge = 86400` は従来の24時間の公開待機を維持し、例外は `minimumReleaseAgeExcludes`、依存の実行許可は `package.json` の `trustedDependencies` に置く。CI は `scripts/Initialize-BunBuild.ps1 -VersionFile package.json` で同じ実行環境を準備する。

## 開発と検証

CI に合わせる場合は Bun 1.4.4 を使い、依存関係は `bun.lock` を正本とします。

```bash
bun run deps             # lockfile に従うインストール
bun --bun run test                                 # Bun の node:test 互換の全テスト
bun test tests/settings.test.js         # 単一ファイル
bun test --test-name-pattern="<名前>" tests/*.test.js
bun --bun run sync:support                         # 共通 JS/CSS を同期
bun --bun run sync:support --check                 # 書き換えずに正本との一致を検証
bun --bun run generate-icons                       # sharp で icons/ を生成
bun --bun run generate-screenshots                 # puppeteer でストア画像を生成
bun --bun run build                                # support 同期 + icons + screenshots
bash zip.sh                               # Git Bash + zip コマンドで配布 ZIP 作成
pwsh -NoProfile -File zip.ps1              # Windows で配布 ZIP 作成
```

- 初回準備は依存インストール後に `bun --bun run build` を実行します。拡張の動作確認は `chrome://extensions` の「パッケージ化されていない拡張機能を読み込む」でリポジトリ直下を指定し、編集後に拡張をリロードします。
- 実装変更後は `bun --bun run test` を実行します。テストは外部フレームワークやビルドを介さずソースを直接読みます。UI の表示・操作は実際のポップアップでも確認します。
- 共通サポート部品の正本は `@kagayoi/support-extension` です。同梱ファイルの直接改変は行わず、正本の package 更新後に `bun --bun run sync:support` で反映します。`bun --bun run sync:support --check` で JS 2 本・CSS 3 本の一致、`bun --bun run test` で組み込み契約を検証します。
- ZIP スクリプトと公開 CI は同梱済みの `src/` を梱包し、サポート同期を実行しません。共通部品の更新は梱包前に同期・検証します。`bun --bun run build` は追跡済みアイコンと ignored の `webstore/images/` を生成します。

## 変更時に維持する契約

- データ型を変更するときは `src/shared/settings.js` の `DATA_TYPES`、`DATA_TYPE_MESSAGE_KEYS`、`normalizeDataToRemove`、`STARTUP_RELOAD_DATA_TYPES`、既定選択を点検し、`popup.html` の checkbox value と `_locales/{en,ja}/messages.json` を揃えます。`cache` と `cacheStorage` は独立した選択肢として維持します。
- 期間を変更するときは `TIME_PERIODS`、`TIME_PERIOD_MESSAGE_KEYS`、`getSince`、既定値、ポップアップと翻訳を揃えます。
- Service Worker の共有処理は DOM 非依存の `settings.js` / `security.js` を使います。`localize.js` はポップアップで読み込みます。
- メッセージ処理の変更では送信元認可と保存設定による削除対象の決定を維持し、`tests/security.test.js` と `tests/background.test.js` で確認します。削除・再読み込みの並行性とエラー通知は [DESIGN.md](DESIGN.md#データフロー) に照合します。
- ポップアップの設定処理を変更した場合は、保存遅延・保存失敗・読込失敗を実際のポップアップで確認します。保存中と削除中の操作抑止、変更時の削除確認解除、保存後の再読込とエラー表示を維持します。
- 権限と外部通信の変更時は [DESIGN.md](DESIGN.md#セキュリティと権限) の境界に照合し、manifest、問い合わせ契約、利用者向け説明とプライバシーポリシーの整合を確認します。
- バージョン更新の依頼時は `manifest.json` の `version` を正本として `package.json` と同期します。公開ブランチ名は `release/<manifest version>` に揃えます。

### CWS 公開のHTTP境界

`publish.yml` はビルド済みZIPを `scripts/Publish-Cws.ps1`（PowerShell 7）へ渡す。既存のOAuth secrets・publisher/item IDを維持し、ZIPをストリーム送信し、upload成功を確認してからpublishする。重複・通信断・不明な応答を公開成功として扱わず、ストア状態を確認してから再開する。公開専用npm CLIは使用しない。変更時はHTTP fixtureで成功・版/ID不一致・upload失敗・publish拒否を確認する。

CWS公開workflowはrepository固定のconcurrency groupで直列化する。同期uploadの成功・ID・版を確認した場合だけpublishし、非同期uploadはAPI v2でdraft版を要求と結び付けられないため停止する。APIにはuploadとpublishの原子的なCASが無いため、提出中はDashboardや他の手動公開操作を並行しない。

## Bun依存の脆弱性検出

依存の固定復元は `bun run deps` を使う。lock欠落・破損を拒否し、`[run] bun=true` 経由で依存のpostinstallまでBunで実行する。Node.jsがあるPCでも通常の `bun install` を直接使う経路へ戻さない。

日次と手動実行では `bun audit` でlock全体を監査する。ローカルでも同じコマンドで確認できる。BunはDependabotの通常の更新PRには対応するが、脆弱性起点の自動修正PRは `dependency-security.yml` が補完する。日次・手動で全件監査し、隔離領域で `bun audit fix` による候補を作成し、同じrunから既存の Dependency validation を呼ぶ。未対策アドバイザリが減少し、依存以外のmanifest・パッチ・24時間待機を保ち、全検証が成功した場合だけ、検証したマージコミットを競合検知付きの通常pushで取り込む。保護されたブランチには自動pushせず、修正版未公開・互換性・検証失敗は単一のIssueに通知して次回再試行する。生の監査は警告を除外せず、対策済みパッチの認定も監査成功とは区別してsummaryへ残す。既知のdeepmerge対策はアドバイザリ・版・パッチSHAが完全一致した場合だけ修正対象から外し、生監査には残す。通常のDependabot更新と他ecosystemの設定は維持する。
