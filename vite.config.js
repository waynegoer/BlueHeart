import { defineConfig } from 'vite';

// base 必须与仓库名一致，GitHub Pages 会部署到 https://waynegoer.github.io/BlueHeart/
export default defineConfig({
  base: '/BlueHeart/',
  build: {
    outDir: 'dist',
  },
});
