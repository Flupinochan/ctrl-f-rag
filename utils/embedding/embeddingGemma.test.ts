import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { autoTokenizerFromPretrained, autoModelFromPretrained } = vi.hoisted(() => ({
  autoTokenizerFromPretrained: vi.fn(),
  autoModelFromPretrained: vi.fn(),
}));

vi.mock('@huggingface/transformers', () => ({
  AutoTokenizer: { from_pretrained: autoTokenizerFromPretrained },
  AutoModel: { from_pretrained: autoModelFromPretrained },
}));

const { buildPrefixedText, EmbeddingGemmaProvider } = await import('./embeddingGemma');

// テスト用の疑似Tensor、実物と同じslice/normalize/tolistの挙動のみ再現する
class FakeTensor {
  constructor(private readonly data: number[][]) {}

  slice(_rows: null, [start, end]: [number, number]): FakeTensor {
    return new FakeTensor(this.data.map((row) => row.slice(start, end)));
  }

  normalize(): FakeTensor {
    return new FakeTensor(
      this.data.map((row) => {
        const norm = Math.sqrt(row.reduce((sum, value) => sum + value * value, 0));
        return row.map((value) => value / norm);
      }),
    );
  }

  tolist(): number[][] {
    return this.data;
  }
}

type FakeModelInputs = { prefixed: string[] };

let tokenizerFn: ReturnType<typeof vi.fn>;
let modelFn: ReturnType<typeof vi.fn> & { dispose: ReturnType<typeof vi.fn> };

beforeEach(() => {
  tokenizerFn = vi.fn((texts: string[]) => ({ prefixed: texts }));
  modelFn = Object.assign(
    vi.fn(async (inputs: FakeModelInputs) => ({
      sentence_embedding: new FakeTensor(inputs.prefixed.map((text) => [text.length, 1, 2, 3])),
    })),
    { dispose: vi.fn(async () => []) },
  );
  autoTokenizerFromPretrained.mockResolvedValue(tokenizerFn);
  autoModelFromPretrained.mockResolvedValue(modelFn);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('buildPrefixedText', () => {
  it('queryにはsearch resultのprefixを付ける', () => {
    expect(buildPrefixedText('赤い惑星', { task: 'query' })).toBe(
      'task: search result | query: 赤い惑星',
    );
  });

  it('titleを指定しなければdocumentのprefixに既定値noneを使う', () => {
    expect(buildPrefixedText('本文', { task: 'document' })).toBe('title: none | text: 本文');
  });

  it('documentのprefixに指定したtitleを埋め込む', () => {
    expect(buildPrefixedText('本文', { task: 'document', title: '見出し' })).toBe(
      'title: 見出し | text: 本文',
    );
  });

  it('titleに$&や$$が含まれても特殊な置換パターンとして解釈しない', () => {
    expect(buildPrefixedText('本文', { task: 'document', title: '$& off $$ sale' })).toBe(
      'title: $& off $$ sale | text: 本文',
    );
  });
});

describe('EmbeddingGemmaProvider', () => {
  it('initを複数回呼んでもtokenizerとmodelのロードは1回だけ', async () => {
    const provider = new EmbeddingGemmaProvider();

    await Promise.all([provider.init(), provider.init()]);
    await provider.init();

    expect(autoTokenizerFromPretrained).toHaveBeenCalledTimes(1);
    expect(autoModelFromPretrained).toHaveBeenCalledTimes(1);
  });

  it('指定したbatchSizeどおりにtextsを分割する', async () => {
    const provider = new EmbeddingGemmaProvider();

    await provider.embed(['a', 'b', 'c', 'd', 'e'], { task: 'document', batchSize: 2 });

    expect(modelFn).toHaveBeenCalledTimes(3);
    const batchSizes = modelFn.mock.calls.map((call) => (call[0] as FakeModelInputs).prefixed.length);
    expect(batchSizes).toEqual([2, 2, 1]);
  });

  it('dimensionsが最大次元数のときはmodelの出力をそのまま返す', async () => {
    const provider = new EmbeddingGemmaProvider();

    const [embedding] = await provider.embed(['hello'], { task: 'query' });

    const expectedLength = buildPrefixedText('hello', { task: 'query' }).length;
    expect(embedding).toEqual([expectedLength, 1, 2, 3]);
  });

  it('dimensionsが最大次元数より小さいときはembeddingを切り詰めて再正規化する', async () => {
    const provider = new EmbeddingGemmaProvider({ dimensions: 2 });

    const [embedding] = await provider.embed(['hello'], { task: 'query' });

    expect(embedding).toHaveLength(2);
    const norm = Math.sqrt((embedding ?? []).reduce((sum, value) => sum + value * value, 0));
    expect(norm).toBeCloseTo(1);
  });

  it('dimensionsが0以下または最大次元数を超える場合はコンストラクタで例外を投げる', () => {
    expect(() => new EmbeddingGemmaProvider({ dimensions: 0 })).toThrow(RangeError);
    expect(() => new EmbeddingGemmaProvider({ dimensions: -1 })).toThrow(RangeError);
    expect(() => new EmbeddingGemmaProvider({ dimensions: 769 })).toThrow(RangeError);
  });

  it('batchSizeが0以下なら例外を投げる', async () => {
    const provider = new EmbeddingGemmaProvider();

    await expect(
      provider.embed(['hello'], { task: 'query', batchSize: 0 }),
    ).rejects.toThrow(RangeError);
  });

  it('init()が一度失敗しても、次回のinit()で再試行できる', async () => {
    autoTokenizerFromPretrained.mockRejectedValueOnce(new Error('network error'));
    const provider = new EmbeddingGemmaProvider();

    await expect(provider.init()).rejects.toThrow('network error');
    await expect(provider.init()).resolves.toBeUndefined();

    expect(autoTokenizerFromPretrained).toHaveBeenCalledTimes(2);
  });
});

describe('getEmbeddingProvider', () => {
  it('引数なしで複数回呼んでも同じインスタンスを返す', async () => {
    vi.resetModules();
    const { getEmbeddingProvider } = await import('./embeddingGemma');

    expect(getEmbeddingProvider()).toBe(getEmbeddingProvider());
  });

  it('同じoptionsで呼べば同じインスタンスを返す', async () => {
    vi.resetModules();
    const { getEmbeddingProvider } = await import('./embeddingGemma');

    const first = getEmbeddingProvider({ dimensions: 256 });
    const second = getEmbeddingProvider({ dimensions: 256 });

    expect(first).toBe(second);
  });

  it('最初と異なるoptionsで呼ぶと例外を投げる', async () => {
    vi.resetModules();
    const { getEmbeddingProvider } = await import('./embeddingGemma');

    getEmbeddingProvider({ dimensions: 768 });

    expect(() => getEmbeddingProvider({ dimensions: 128 })).toThrow(
      'getEmbeddingProvider was already initialized with different options',
    );
  });
});
