# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Chrome拡張機能、開いているページの内容をvector (意味) 検索し該当箇所へジャンプできるツール
アーキテクチャ・技術選定の決定事項は全て `docs/design.md` が正、ディレクトリ構成の目標形は `docs/structure.md` が正

@docs/design.md
@docs/structure.md

## 開発環境

パッケージマネージャーはbun、npm/pnpm/yarnは使わない
WXT (Viteベース) + React + Tailwind CSS、`wxt.config.ts` の `modules: ['@wxt-dev/module-react']` でReact統合
WXTはdev時に `tabs`/`scripting` 権限、sidepanel entrypointがあれば `sidepanel` 権限を自動でmanifestに追加する、`manifest.permissions` に重複して手動追加しない

## 現在の状態

`entrypoints/` はまだWXT+Reactデフォルトテンプレートのまま (popupのみ)、`docs/structure.md` が示す目標構成 (sidepanel/, components/, hooks/, utils/, e2e/) への移行はこれから

## Lint

ESLint 9 flat config (`eslint.config.mjs`)、`bun run lint` で実行
`eslint-plugin-react` の `settings.react.version` は `'detect'` ではなく固定文字列を指定する、ESLint 10 + eslint-plugin-reactの組み合わせで `'detect'` がクラッシュするため (`contextOrFilename.getFilename is not a function`)
WXTの自動import変数 (`browser`, `defineBackground`, `useState`等) は `wxt.config.ts` の `imports.eslintrc.enabled: 9` で生成される `.wxt/eslint-auto-imports.mjs` をeslint.config.mjs先頭でimportして認識させる、`wxt prepare` (postinstallで自動実行) で再生成される

## ドキュメント運用

新しい技術的決定を `docs/design.md` に書き込む前に、必ずユーザーに確認を取る、自動では追記しない

## WSL環境での拡張機能読み込み

`bun run build` または `bun run dev` で `.output/chrome-mv3` (または `chrome-mv3-dev`) が生成される
Windows側Chromeで読み込む場合は `wslpath -w <path>` でUNCパス (`\\wsl.localhost\<ディストリ名>\...`) を取得し、`chrome://extensions` の「パッケージ化されていない拡張機能を読み込む」に貼り付ける
