import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  root: 'web',
  plugins: [vue()],
  build: { outDir: '../dist', emptyOutDir: true },
  // npm run dev:web 时，页面里的 /api 请求转给后端
  server: { proxy: { '/api': 'http://127.0.0.1:6688' } },
});
