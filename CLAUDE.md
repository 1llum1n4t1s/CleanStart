# Clean Start

Chrome 拡張機能。ワンクリックでブラウザの履歴・キャッシュ・Cookie などを削除する。

## プロジェクト構成

```
manifest.json          # 拡張マニフェスト (MV3)
popup.html             # ポップアップ UI
src/
  background/          # Service Worker
  popup/               # ポップアップ JS/CSS
  shared/              # 共有モジュール (settings.js, localize.js)
_locales/en|ja/        # i18n メッセージ
tests/                 # Node テスト
icons/                 # 拡張アイコン
webstore/              # ストア掲載用素材
docs/                  # privacy-policy.md
```

## 主要コマンド

```bash
npm test                     # テスト実行
npm run generate-icons        # アイコン生成
npm run generate-screenshots  # スクリーンショット生成
bash zip.sh                  # 配布用 zip 作成
```

## バージョン管理

`manifest.json` の `version` フィールドが正式バージョン。`package.json` も同期する。

## 注意事項

- Avalonia/WPF 構文は使わない（Chrome 拡張のため無関係）
- テストは Node.js built-in test runner (`node --test`)
- manifest_version: 3 (MV3)
