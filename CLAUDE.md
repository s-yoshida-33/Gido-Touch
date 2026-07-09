# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Gido-Touch は、商業施設の**大型タッチディスプレイ**用フロアガイドアプリ。Gido（大型非タッチ版）から派生した派生アプリで、Tauri2 + React19 + TypeScriptのWindows x64キオスクアプリ。地図・店舗一覧に加え、タッチ操作（タップ音フィードバック、タッチスクロール）を持つ。

Gidoと同様、同一STB上のBridge-Ground（`C:\dev\Bridge-Ground`、:8090）から店舗データ、WonderScreen CMS（別プロダクト、wonder-screen-frontendのバックエンド、:8080番台）からサイネージ映像タイムラインを取得する。

現バージョン: 1.1.37（`package.json`）。Gidoと同時期にElectronからTauriへ移行。拠点別ビルドモード（`dev:halong`/`dev:suzaka`/`dev:sendaikamisugi`）を持つ点がGidoとの主な違い。

## Repository layout

Gidoとほぼ同じ構成（`src/api/`, `src/screens/`, `src/components/`, `src/hooks/`, `src/repositories/`, `src/config/`, `src/contexts/`, `src/types/`）に加えて:

- `src/maps/malls/<拠点名>/` — 拠点別の地図SVG（例: `halong/`）
- `src/screens/halong/` — 拠点別の画面バリエーション（タッチスクロール対応等）
- `src/services/SSEService.ts` — SSE接続管理（Gidoは`src/api/sseClient.ts`という別名で同等の役割）
- `src/hooks/useTouchSound.ts` — タップ音フィードバック（タップ距離<10px・時間<500msを検証してから再生）

## Development commands

Docker不使用。Node + Rust + Tauri CLIのローカル環境で直接実行する。

```bash
npm run dev                    # Viteのみ
npm run tauri:dev              # Tauri込みの開発実行（通常はこちら）
npm run dev:halong              # 拠点別モード（Vite --mode dev-halong）
npm run dev:suzaka
npm run dev:sendaikamisugi
npm run build                  # tsc -b && vite build
npm run lint
```

リリースビルド:
```bash
npm run tauri:build:signed     # 署名付きビルド（build/runner.js経由）
npm run tauri:release          # 署名付きビルド + GitHub Release管理
npm run bump:version
npm run optimize:media / npm run media:compress / npm run data:compress
```

## Known gotchas

- **Bridge-Ground・WonderScreen CMSともにGidoと同じ前提**（同一コンピュータ、localhost:8090 / 8080番台）。
- **拠点別モード（halong/suzaka/sendaikamisugi）の存在に注意**。`npm run dev`だけだと既定モードで、拠点特有のレイアウト・地図が反映されない場合がある。動作確認時はどの拠点向けか確認する。
- **タッチイベントの誤爆防止**: `useTouchSound`はタップ距離・時間を検証してから音を再生する作りなので、単純なclickイベントとは判定が異なる。タッチ関連の不具合調査時はこのフィルタ条件を確認する。
- **CMS_API.mdのタイトルは「WonderScreen Local API」**だが、Gido側の実装するローカルAPI仕様のドキュメント（WonderScreen CMS本体のAPIではない）。

## Branches & deploy flow

- 作業は `dev` を起点に `hotfix/<内容>` または `feature/<内容>` ブランチを作成して行う（git worktreeで作業ディレクトリを分けるのが基本、`C:\dev\floor-guide-Issue\#000.md`参照）
- 作業完了後はそのブランチをpushしてPRを作成し、`dev`へのマージが完了した時点で対応するIssueをクローズする
- 過去は`dev`に直接作業・pushする運用だったが、複数リポジトリ・複数タスクの並行作業に対応するため上記のブランチ運用に移行した
- リリースは`npm run tauri:release`。自動更新は`dl.tti.ninja`経由。

## Architecture

```
Bridge-Ground（同一STB、:8090）──shops/news/specials/genres/floors + SSE──► 地図＋店舗リスト画面（タッチ操作対応）
WonderScreen CMS（:8080番台）────映像タイムライン + SSE──────────────────► サイネージ枠
```

- Gidoとほぼ同一のデータフローに、タッチ操作層（タップ音・スクロール処理）と拠点別UI差分が乗った構成。

## Code conventions

- ESLint（`npm run lint`）に従う。
- コミットメッセージは変更内容が明確に伝わるものにする。複数ファイルの変更を1コミットにまとめても構わない。

## Project context

Gido-Touchは「フロアガイド」製品群のうち、Gido（大型非タッチ）から分岐した大型タッチ版。Gido-Touch-Mini（小型タッチ版）はさらにここから機能を削った派生。他の4リポジトリ（Gido/Gido-Touch-Mini/Grain-Link/Bridge-Ground/portal-cms）と合わせて`s-yoshida-33`配下でホストされている姉妹プロジェクト。ワークフロー運用ルールは`C:\dev\floor-guide-Issue\#000.md`を参照。
