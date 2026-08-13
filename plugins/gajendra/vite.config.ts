import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    outDir: "dist",
    // UI-only builds are also used by Playwright. Preserve the separately
    // bundled MCP server instead of leaving dist incomplete after UI tests.
    emptyOutDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: "gajendra.html",
      output: {
        entryFileNames: "ui.js",
        assetFileNames: "ui.[ext]",
      },
    },
  },
});
