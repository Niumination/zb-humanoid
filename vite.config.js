import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three-core';
          if (id.includes('three/addons/controls/OrbitControls')) return 'three-controls';
          if (id.includes('three/addons/loaders/GLTFLoader') || id.includes('three/addons/math/MeshSurfaceSampler')) return 'three-loaders';
          if (id.includes('three/addons/postprocessing')) return 'three-postfx';
        }
      }
    }
  },
  server: {
    port: 3000,
    host: true
  }
});
