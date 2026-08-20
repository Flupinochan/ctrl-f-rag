import { describe, expect, it } from 'vitest';
import { cosineSimilarity } from '../similarity';
import { EmbeddingGemmaProvider, FULL_DIMENSIONS } from './embeddingGemma';

// 初回に約200MBのモデルダウンロードが発生するため、このファイルのテストだけ長めのtimeoutにする
const MODEL_DOWNLOAD_TIMEOUT = 600_000;

// 実モデル (約200MB) をダウンロードして検証するため、RUN_MODEL_TESTS=1指定時のみ実行する
describe.skipIf(!process.env.RUN_MODEL_TESTS)('EmbeddingGemmaProvider (実モデル)', () => {
  it('正規化済みの768次元embeddingを生成する', async () => {
    const provider = new EmbeddingGemmaProvider();
    const [embedding] = await provider.embed(['Hello world'], { task: 'document' });

    expect(embedding).toHaveLength(FULL_DIMENSIONS);
    const norm = Math.sqrt((embedding ?? []).reduce((sum, value) => sum + value * value, 0));
    expect(norm).toBeCloseTo(1, 2);

    await provider.dispose();
  }, MODEL_DOWNLOAD_TIMEOUT);

  it('意味的に最も近いdocumentを最上位にランクする (英語)', async () => {
    const provider = new EmbeddingGemmaProvider();
    const documents = [
      { title: 'Mars', text: 'Mars is often called the Red Planet because of its rusty color.' },
      { title: 'Venus', text: 'Venus is the hottest planet due to its thick, toxic atmosphere.' },
      { title: 'Jupiter', text: 'Jupiter is the largest planet in the Solar System.' },
    ];

    const [queryEmbedding] = await provider.embed(['Which planet is known as the Red Planet?'], {
      task: 'query',
    });
    const documentEmbeddings = await provider.embed(
      documents.map((doc) => doc.text),
      { task: 'document' },
    );

    const scored = documents
      .map((doc, index) => ({
        title: doc.title,
        score: cosineSimilarity(queryEmbedding ?? [], documentEmbeddings[index] ?? []),
      }))
      .sort((a, b) => b.score - a.score);

    expect(scored[0]?.title).toBe('Mars');

    await provider.dispose();
  }, MODEL_DOWNLOAD_TIMEOUT);

  it('意味的に最も近いdocumentを最上位にランクする (日本語)', async () => {
    const provider = new EmbeddingGemmaProvider();
    const documents = [
      { title: '火星', text: '火星はその赤い色から赤い惑星と呼ばれている' },
      { title: '金星', text: '金星は分厚い有毒な大気のため太陽系で最も高温の惑星である' },
      { title: '木星', text: '木星は太陽系最大の惑星である' },
    ];

    const [queryEmbedding] = await provider.embed(['赤い惑星と呼ばれるのはどれ'], {
      task: 'query',
    });
    const documentEmbeddings = await provider.embed(
      documents.map((doc) => doc.text),
      { task: 'document' },
    );

    const scored = documents
      .map((doc, index) => ({
        title: doc.title,
        score: cosineSimilarity(queryEmbedding ?? [], documentEmbeddings[index] ?? []),
      }))
      .sort((a, b) => b.score - a.score);

    expect(scored[0]?.title).toBe('火星');

    await provider.dispose();
  }, MODEL_DOWNLOAD_TIMEOUT);
});
