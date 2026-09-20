# AIスレ速報

AIニュースをRSSで取得し、Claudeが「架空の2ch風スレ」を生成して、まとめブログ風の静的サイトにするツールです。

## 使い方

```bash
npm install
npm run generate        # 新着ニュースからスレを生成（data/threads/*.json）
npm run build           # 静的サイトを docs/ に出力
npm run preview         # http://localhost:8080 で確認
npm run update          # generate + build をまとめて実行
```

`ANTHROPIC_API_KEY` の環境変数が必要です。

### generate のオプション

```bash
npm run generate -- --dry-run            # APIを呼ばずに、処理対象のニュースを表示するだけ
npm run generate -- --count 5            # 生成する件数を指定
npm run generate -- --title "ニュースのタイトル" --summary "概要" --url "https://..."  # ニュースを手動で指定
```

## ファイル構成

| パス | 内容 |
|---|---|
| `config.js` | サイト名、RSSフィード、キーワード、モデル、カテゴリの設定 |
| `lib/news.js` | RSSの取得とAI関連記事の絞り込み |
| `lib/generate.js` | Claudeによるスレ生成（プロンプトと出力スキーマ） |
| `lib/render.js` | HTMLテンプレート |
| `static/style.css` | デザイン |
| `data/threads/` | 生成したスレ（JSON形式）。気に入らない記事はこのファイルを消して build し直す |
| `data/seen.json` | 処理済みニュースのURL（同じニュースで二重に生成しないため） |
| `docs/` | ビルド結果。GitHub Pages の公開フォルダにそのまま使えます |

## 公開（GitHub Pages）

1. `config.js` の `site.url` を公開URLに変更する
2. GitHubにpushし、Settings → Pages で「Deploy from a branch」を選び、`main` ブランチの `/docs` を指定する

## 注意

- スレはすべてAIが作った架空のものです。サイト内にもその旨を表示しています。
- ニュースはRSSのタイトルと概要だけを使い、記事本文は転載しません。詳しい内容は元記事へのリンクで案内しています。
