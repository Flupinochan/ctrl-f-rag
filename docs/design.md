# Ctrl+F RAG 拡張機能 設計要件定義確定

## 概要

Chrome拡張機能
開いているページの内容をvector検索し、該当箇所へジャンプできるツール
ブラウザ標準のCtrl+Fとの違いはvector (意味) 検索である点

## 基本構成

**採用**

UI形式、Side Panel (chrome.sidePanel API)
起動キー、Ctrl+Shift+F、chrome.commands APIで割り当て
開閉動作、トグル、chrome.sidePanel.open() と close() を組み合わせる、close()はChrome 141以降のみ対応
データ永続化、なし、side panelのJSコンテキストが破棄されればメモリも消える
対象範囲、現在開いているタブ1ページのみ
ページ本文取得、Content Script経由、chrome.tabs.sendMessage()

## Embedding実行ライブラリ

| ライブラリ | 位置づけ | embedding用途での成熟度 |
|---|---|---|
| Transformers.js | Hugging Face製、高レベルAPI | 高い、feature-extraction用パイプラインが標準提供されている |
| ONNX Runtime Web | Microsoft製、低レベル実行エンジン | 中程度、tokenizeや前後処理を自前実装する必要がある |
| WebLLM | MLC-AI製、WebGPU特化 | 低い、主眼はLLMのテキスト生成、embedding抽出は主用途でない |
| Chrome内蔵Prompt API (Gemini Nano) | ブラウザ標準搭載、モデルダウンロード不要 | 低い、現状は要約・翻訳・対話が中心でembedding抽出は標準サポート対象外 |
| LiteRT.js | Google製、低レベルランタイム、Gemma系に最適化 | 中程度、tokenize等を自前実装する必要があり実装例も少ない |

**採用: Transformers.js**

embeddingモデルのtokenize処理やテンソル変換を自前実装せずに済み、開発コストを抑えられるため採用する
内部でONNX Runtime Webを利用しているため、後に低レベル制御が必要になった場合も同じ基盤上で移行できる
WebLLM、Chrome内蔵Prompt API、LiteRT.jsは、実装コストまたは成熟度の面で今回の用途に見合わないため除外する

## Embeddingモデル

Hugging Face上のライブラリ (transformers.js) / pipeline_tag / language / other (text-embeddings-inference) の各フィルタ調査、および技術記事の調査を経て、最終候補を3つに絞った

| モデル | パラメータ数 | 次元数 | 対応言語数 | 最大トークン長 | ライセンス | 量子化サイズ | 月間downloads | likes |
|---|---|---|---|---|---|---|---|---|
| Xenova/multilingual-e5-small | 118M | 384 | 100 | 512 | MIT | 118MB | 146k | 17 |
| Xenova/paraphrase-multilingual-MiniLM-L12-v2 | 118M | 384 | 50 | 128 | Apache 2.0 | 118MB | 173k | 18 |
| onnx-community/embeddinggemma-300m-ONNX | 308M | 768、MRLで128まで縮小可 | 100以上 | 未確認 | Apache 2.0 | 176MB (q4f16) 〜310MB (quantized) | 172.5k | 73 |

**採用: onnx-community/embeddinggemma-300m-ONNX (仮決定、後で比較検証する)**

Gemmaブランドとしての知名度を優先し採用する
技術的な後押しとして、Google公式が「ブラウザで100%ローカル実行可能」と明言している唯一の候補である点、likesが73と他の多言語候補 (最大でも18) を大きく上回る点、MRL対応で次元数を柔軟に縮小できる点がある

**prefix要件 (必須)**

クエリ、`task: search result | query: {クエリ文}`
chunk (文書側)、`title: none | text: {chunkのテキスト}`

公式が「省略すると精度を大きく損なう」と明記しているため、embedding生成処理に必ず組み込む
`title:`部分はページタイトルや見出しを渡すことで精度向上が期待できる、chunk化時のDOM構造情報と紐付けて拡張の余地あり

**検索結果の表示件数・閾値**

**採用: 表示件数の上限は設けない、足切りは相対的な閾値方式**

cosine類似度の絶対値はモデル依存のため固定閾値は使わない
結果を類似度順に並べ、隣接スコア間の差が最大になる箇所で足切りする (最大スコア低下点方式)

## モデルの配布方法

**採用: 拡張機能install時にservice worker (background) でダウンロード、拡張機能オリジン配下に共有キャッシュとして保持**

複数モデルを後から追加インストールし使い分けられる構成も見据える
公式のTransformers.js Chrome拡張ガイドが推奨するパターンと一致するため採用する

注意点
service workerは停止・再起動される前提のため、ダウンロード中断からの再開・再初期化を設計に組み込む必要がある
複数モデルの並行保存には `unlimitedStorage` permissionの追加が実質必須

## chunk分割戦略

前提、Ctrl+Fで見つからなかった時のフォールバック用途、検索クエリは単語レベルの短いものが多い想定
短いクエリはembeddingの類似度精度が落ちやすいため (query-document asymmetry)、一般的なRAGのchunkサイズ基準をそのまま使わず補正が必要

**検証中、以下2案から実際に試して選ぶ**

A案、DOM構造 (見出し/段落/箇条書き) でブロック分けした後、文末記号で3文程度グルーピング
B案、Recursive Character Splitting、目標文字数 (日本語150から300文字程度) を決め、段落 > 改行 > 文末記号 > 読点の優先順位で自然な位置に分割

## Vector検索方式

**採用: 総当たりcosine類似度**

今回のchunkサイズ (150から300文字) だと1ページあたり数十から数百chunk程度、長文ページでも数百chunkに収まる
ANNが必要になるのは一般的に数十万ベクトル規模以降のため、今回の規模ではANN導入はオーバースペック

## プロジェクトセットアップ

**採用: WXT + React + Tailwind CSS**

注意点
Chrome拡張のservice worker内でTransformers.jsの推論バックエンド (WASM/WebGPU) を初期化しようとすると失敗するissueが未解決 (`import()` がServiceWorkerGlobalScopeで禁止されているため)
embeddingの推論実行はside panel側で行う方針とし、service workerはモデルのダウンロード・キャッシュ管理のみに用途を限定する

## ハイライト/ジャンプ実装

**採用: CSS Custom Highlight API + scrollIntoView**

Baseline対応済み (Chrome/Edge 105+) でDOM構造を変更せずに範囲を装飾できるため採用する
Text Fragments (`#:~:text=`) は文字列の完全一致が前提の機能のため、意味検索の結果には合わず不採用
ジャンプ指示はside panelからContent Scriptへメッセージ送信する形で行う

## 対象範囲・同期方針

**採用**

対象範囲、メインフレームのみ、iframe内コンテンツは対応しない (広告など外部ページの可能性があるため)
同期タイミング、side panelを開いたタイミングで即同期、再同期は手動 + 自動 (SPA変化検知) を併用
検索入力、初回embedding未完了時は入力不可、一度でもembedding済みなら再同期中でも検索可能にする (UX優先)
content scriptが実行できないページ (chrome://等)、iframe非対応時と同様にエラー表示または入力不可にする、`chrome.tabs.sendMessage` + `chrome.runtime.lastError` (またはtry/catch) で検知する
巨大ページ、上限は設けない、処理時間が伸びるのみ許容する
同期時間の目安表示、文字数量ごとの処理時間を後日検証し、画面に想定同期時間を表示する

## 参考

- [chrome.commands API](https://developer.chrome.com/docs/extensions/reference/api/commands)
- [chrome.sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Add a popup](https://developer.chrome.com/docs/extensions/develop/ui/add-popup)
