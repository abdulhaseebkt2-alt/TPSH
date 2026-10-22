import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    host: true
  },
  preview: {
    port: 4173,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['@supabase/supabase-js', 'lucide'],
          xlsx: ['xlsx']
        }
      }
    }
  }
});
