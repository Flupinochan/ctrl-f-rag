import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    // 実モデルの統合テストは初回に約200MBのダウンロードが発生するため長めに取る
    testTimeout: 600_000,
  },
});
