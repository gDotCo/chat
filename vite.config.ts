import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.BASE_PATH,
    // define: {
    //   'process.env.VITE_ABLY_KEY': JSON.stringify(env.VITE_ABLY_KEY)
    // },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
  server: {
    proxy: {
      '/api': {
        target: 'https://www.hamper-studio.store/api',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  };
});