import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          // Correct path based on your dir output
          src: 'node_modules/@elevenlabs/client/worklets/rawAudioProcessor.js',
          dest: 'elevenlabs',
        },
        {
          // Assuming this one follows the same pattern
          src: 'node_modules/@elevenlabs/client/worklets/audioConcatProcessor.js',
          dest: 'elevenlabs',
        },
      ],
    }),
  ],
});