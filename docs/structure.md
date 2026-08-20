# Ctrl+F RAG 拡張機能 ディレクトリ構成

```
entrypoints/
  sidepanel/
    index.html
    main.tsx
  popup/
    index.html
    main.tsx
  background.ts
  content.ts

components/
  sidepanel/
    App.tsx
    App.test.tsx
    SearchInput.tsx
    SearchInput.test.tsx
    SearchResultList.tsx
    SearchResultList.test.tsx
    SearchResultItem.tsx
    SearchResultItem.test.tsx
  popup/
    App.tsx
    App.test.tsx

hooks/
  useSemanticSearch.ts
  useSemanticSearch.test.ts

utils/
  chunking/
    types.ts
    recursiveSplit.ts
    recursiveSplit.test.ts
  embedding/
    types.ts
    embeddingGemma.ts
    embeddingGemma.test.ts
  similarity.ts
  similarity.test.ts

assets/
  tailwind.css

public/
  icon/
    16.png
    32.png
    48.png
    96.png
    128.png

e2e/
  search.spec.ts

wxt.config.ts
vitest.config.ts
tsconfig.json
package.json
```

## 命名規則

| 種類 | 拡張子 | 例 |
|---|---|---|
| Reactコンポーネント本体 | `.tsx` | `SearchInput.tsx` |
| componentテスト | `.test.tsx` | `SearchInput.test.tsx` |
| ロジック本体 (hooks/utils) | `.ts` | `similarity.ts` |
| unitテスト | `.test.ts` | `similarity.test.ts` |
| E2E | `.spec.ts` | `search.spec.ts` |

## 補足

`components/`は`entrypoints/`と同様にsidepanelとpopupでサブディレクトリを分ける
componentsに含まれるファイル名は現時点でのたたき台であり、実装を進める中で分割粒度は変わりうる
`utils/embedding/types.ts`、`utils/chunking/types.ts`には、それぞれ`EmbeddingProvider`、`ChunkingStrategy`のinterfaceを定義し、実装を差し替え可能にする
テストはco-locate方式、テスト対象ファイルと同じディレクトリに配置する、E2Eのみ`e2e/`に独立配置する
popup.htmlの役割 (基本設定・機能ON/OFF用UI) は詳細要件が未確定
