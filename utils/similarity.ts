import { cos_sim as cosineSimilarity } from '@huggingface/transformers';

export { cosineSimilarity };

export type SimilarityEntry<T> = {
  id: T;
  embedding: number[];
};

export type SimilarityMatch<T> = {
  id: T;
  score: number;
};

export function rankBySimilarity<T>(
  queryEmbedding: number[],
  entries: SimilarityEntry<T>[],
): SimilarityMatch<T>[] {
  return entries
    .map((entry) => ({ id: entry.id, score: cosineSimilarity(queryEmbedding, entry.embedding) }))
    .sort((a, b) => b.score - a.score);
}

export type CutoffOptions = {
  minResults?: number;
};

const DEFAULT_MIN_RESULTS = 2;

// design.mdの「最大スコア低下点方式」: cosine類似度の絶対値はモデル依存で
// 固定閾値が使えないため、隣接スコア間の差が最大になる箇所で足切りする
export function cutoffByMaxScoreDrop<T>(
  ranked: SimilarityMatch<T>[],
  { minResults = DEFAULT_MIN_RESULTS }: CutoffOptions = {},
): SimilarityMatch<T>[] {
  if (ranked.length <= minResults) return ranked;

  let cutoffIndex = ranked.length;
  let maxDrop = 0;
  for (let i = minResults; i < ranked.length; i++) {
    const current = ranked[i - 1];
    const next = ranked[i];
    if (!current || !next) continue;
    const drop = current.score - next.score;
    if (drop > maxDrop) {
      maxDrop = drop;
      cutoffIndex = i;
    }
  }
  return ranked.slice(0, cutoffIndex);
}
