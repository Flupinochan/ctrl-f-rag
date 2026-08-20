import { describe, expect, it } from 'vitest';
import { cosineSimilarity, cutoffByMaxScoreDrop, rankBySimilarity } from './similarity';

describe('cosineSimilarity', () => {
  it('同一vectorなら1を返す', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it('直交するvectorなら0を返す', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('逆向きのvectorなら-1を返す', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });
});

describe('rankBySimilarity', () => {
  it('クエリとの類似度が高い順にソートする', () => {
    const query = [1, 0];
    const entries = [
      { id: 'orthogonal', embedding: [0, 1] },
      { id: 'exact', embedding: [1, 0] },
      { id: 'opposite', embedding: [-1, 0] },
    ];

    const ranked = rankBySimilarity(query, entries);

    expect(ranked.map((match) => match.id)).toEqual(['exact', 'orthogonal', 'opposite']);
  });

  it('候補が空なら空配列を返す', () => {
    expect(rankBySimilarity([1, 0], [])).toEqual([]);
  });
});

describe('cutoffByMaxScoreDrop', () => {
  it('件数がminResults以下なら何も削らない', () => {
    const ranked = [
      { id: 'a', score: 0.9 },
      { id: 'b', score: 0.1 },
    ];
    expect(cutoffByMaxScoreDrop(ranked)).toEqual(ranked);
  });

  it('隣接スコアの差が最大の位置で足切りする', () => {
    const ranked = [
      { id: 'a', score: 0.95 },
      { id: 'b', score: 0.9 },
      { id: 'c', score: 0.85 },
      { id: 'd', score: 0.2 },
      { id: 'e', score: 0.1 },
    ];

    const result = cutoffByMaxScoreDrop(ranked);

    expect(result.map((match) => match.id)).toEqual(['a', 'b', 'c']);
  });

  it('最大の差が上位側にあってもminResults未満にはならない', () => {
    const ranked = [
      { id: 'a', score: 0.9 },
      { id: 'b', score: 0.1 },
      { id: 'c', score: 0.09 },
      { id: 'd', score: 0.08 },
    ];

    const result = cutoffByMaxScoreDrop(ranked, { minResults: 2 });

    expect(result.map((match) => match.id)).toEqual(['a', 'b']);
  });

  it('全スコアが同じなら足切りしない', () => {
    const ranked = [
      { id: 'a', score: 0.5 },
      { id: 'b', score: 0.5 },
      { id: 'c', score: 0.5 },
    ];

    expect(cutoffByMaxScoreDrop(ranked)).toEqual(ranked);
  });

  it('空配列でも例外を投げない', () => {
    expect(cutoffByMaxScoreDrop([])).toEqual([]);
  });

  it('minResultsを指定した値どおりに扱う', () => {
    const ranked = [
      { id: 'a', score: 0.9 },
      { id: 'b', score: 0.8 },
      { id: 'c', score: 0.7 },
      { id: 'd', score: 0.1 },
    ];

    const result = cutoffByMaxScoreDrop(ranked, { minResults: 3 });

    expect(result.map((match) => match.id)).toEqual(['a', 'b', 'c']);
  });
});
