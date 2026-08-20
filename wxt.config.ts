import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  imports: {
    eslintrc: {
      enabled: 9,
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
