# CLAUDE.md

## プロジェクト概要

Chrome拡張機能
開いているページの内容をvector (意味) 検索し該当箇所へジャンプできるツール
Ctrl + F による検索のvector版
アーキテクチャ・技術選定の決定事項は `docs/design.md`、ディレクトリ構成の目標形は `docs/structure.md` が正

## 開発環境

WXT + React + Tailwind CSS

## ドキュメント運用

残しておくべきdocumentは `docs/` に配置
作成や編集する際はユーザに確認を取ること

## 現在の目標

`utils` 配下にコアとなるロジックを作成すること
`UI` 側はまだ着手しない
