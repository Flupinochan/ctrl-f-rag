import type { ProgressCallback } from '@huggingface/transformers';

export type EmbeddingTask = 'query' | 'document';

export type EmbeddingDtype = 'fp32' | 'q8' | 'q4';

export type EmbeddingDevice = 'wasm' | 'webgpu';

export type EmbeddingProviderOptions = {
  dtype?: EmbeddingDtype;
  device?: EmbeddingDevice;
  dimensions?: number;
  onProgress?: ProgressCallback;
};

export type EmbedOptions = {
  task: EmbeddingTask;
  title?: string;
  batchSize?: number;
};

export interface EmbeddingProvider {
  readonly dimensions: number;
  init(): Promise<void>;
  embed(texts: string[], options: EmbedOptions): Promise<number[][]>;
  dispose(): Promise<void>;
}
