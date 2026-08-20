import {
  AutoModel,
  AutoTokenizer,
  type PreTrainedModel,
  type PreTrainedTokenizer,
  type Tensor,
} from '@huggingface/transformers';
import type {
  EmbedOptions,
  EmbeddingProvider,
  EmbeddingProviderOptions,
} from './types';

export const MODEL_ID = 'onnx-community/embeddinggemma-300m-ONNX';
export const FULL_DIMENSIONS = 768;
export const DEFAULT_BATCH_SIZE = 16;

const QUERY_PREFIX = 'task: search result | query: ';

export function buildPrefixedText(
  text: string,
  { task, title = 'none' }: Pick<EmbedOptions, 'task' | 'title'>,
): string {
  if (task === 'query') {
    return `${QUERY_PREFIX}${text}`;
  }
  return `title: ${title} | text: ${text}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

// sentence-transformersのPooling/Dense/Normalize層がONNXグラフに焼き込まれているため、
// feature-extraction pipelineのpoolingオプションでは正しい出力にならない
async function loadModel(
  options: EmbeddingProviderOptions,
): Promise<{ tokenizer: PreTrainedTokenizer; model: PreTrainedModel }> {
  const [tokenizer, model] = await Promise.all([
    AutoTokenizer.from_pretrained(MODEL_ID),
    AutoModel.from_pretrained(MODEL_ID, {
      // fp16派生 (q4f16等) はEmbeddingGemmaの活性化関数が非対応のため既定から除外する
      dtype: options.dtype ?? 'q4',
      device: options.device,
      progress_callback: options.onProgress,
    }),
  ]);
  return { tokenizer, model };
}

export class EmbeddingGemmaProvider implements EmbeddingProvider {
  readonly dimensions: number;
  private readonly options: EmbeddingProviderOptions;
  private tokenizer: PreTrainedTokenizer | undefined;
  private model: PreTrainedModel | undefined;
  private loadingPromise: Promise<void> | undefined;

  constructor(options: EmbeddingProviderOptions = {}) {
    const dimensions = options.dimensions ?? FULL_DIMENSIONS;
    if (dimensions <= 0 || dimensions > FULL_DIMENSIONS) {
      throw new RangeError(`dimensions must be between 1 and ${FULL_DIMENSIONS}, got ${dimensions}`);
    }
    this.options = options;
    this.dimensions = dimensions;
  }

  async init(): Promise<void> {
    if (this.tokenizer && this.model) return;
    if (!this.loadingPromise) {
      this.loadingPromise = loadModel(this.options)
        .then(({ tokenizer, model }) => {
          this.tokenizer = tokenizer;
          this.model = model;
        })
        .catch((error: unknown) => {
          this.loadingPromise = undefined;
          throw error;
        });
    }
    await this.loadingPromise;
  }

  async embed(texts: string[], options: EmbedOptions): Promise<number[][]> {
    await this.init();
    if (!this.tokenizer || !this.model) {
      throw new Error('EmbeddingGemmaProvider failed to initialize');
    }
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    if (batchSize <= 0) {
      throw new RangeError(`batchSize must be a positive integer, got ${batchSize}`);
    }
    const result: number[][] = [];
    for (const batch of chunk(texts, batchSize)) {
      const prefixed = batch.map((text) => buildPrefixedText(text, options));
      const modelInputs = await this.tokenizer(prefixed, {
        padding: true,
        truncation: true,
      });
      const { sentence_embedding: sentenceEmbedding } = (await this.model(modelInputs)) as {
        sentence_embedding: Tensor;
      };
      const embeddings =
        this.dimensions < FULL_DIMENSIONS
          ? sentenceEmbedding.slice(null, [0, this.dimensions]).normalize()
          : sentenceEmbedding;
      result.push(...(embeddings.tolist() as number[][]));
    }
    return result;
  }

  async dispose(): Promise<void> {
    await this.model?.dispose();
    this.tokenizer = undefined;
    this.model = undefined;
    this.loadingPromise = undefined;
  }
}

let sharedProvider: EmbeddingGemmaProvider | undefined;
let sharedOptions: EmbeddingProviderOptions | undefined;

function optionsMatch(
  a: EmbeddingProviderOptions | undefined,
  b: EmbeddingProviderOptions | undefined,
): boolean {
  return (
    (a?.dtype ?? 'q4') === (b?.dtype ?? 'q4') &&
    a?.device === b?.device &&
    (a?.dimensions ?? FULL_DIMENSIONS) === (b?.dimensions ?? FULL_DIMENSIONS)
  );
}

export function getEmbeddingProvider(
  options?: EmbeddingProviderOptions,
): EmbeddingGemmaProvider {
  if (!sharedProvider) {
    sharedProvider = new EmbeddingGemmaProvider(options);
    sharedOptions = options;
    return sharedProvider;
  }
  if (!optionsMatch(sharedOptions, options)) {
    throw new Error('getEmbeddingProvider was already initialized with different options');
  }
  return sharedProvider;
}
