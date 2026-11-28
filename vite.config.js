import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api/charts': {
        target: 'https://rss.marketingtools.apple.com',
        changeOrigin: true,
        rewrite: () => '/api/v2/us/music/most-played/10/songs.json',
      },
      '/api/itunes': {
        target: 'https://itunes.apple.com',
        changeOrigin: true,
        rewrite: (path) => `/search${path.replace('/api/itunes', '')}&entity=song&limit=1`,
      },
      '/api/radio': {
        target: 'http://68.233.117.57',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/radio', '/api'),
      },
      '/api/pop-news': {
        target: 'https://www.buzz-music.com',
        changeOrigin: true,
        rewrite: () => '/blog-feed.xml',
      },
      '/hls': {
        target: 'http://68.233.117.57',
        changeOrigin: true,
      },
    },
  },
});
