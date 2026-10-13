import { defineConfig } from "vite";
import { inlineUi } from "./scripts/inline-ui.js";

export default defineConfig({
  plugins: [inlineUi()],
  base: "./",
  build: {
    outDir: "dist",
    // UI-only builds are also used by Playwright. Preserve the separately
    // bundled MCP server instead of leaving dist incomplete after UI tests.
    emptyOutDir: false,
    assetsDir: "",
    assetsInlineLimit: () => true,
    cssCodeSplit: false,
    rolldownOptions: {
      input: "gajendra.html",
      output: {
        codeSplitting: false,
        entryFileNames: "ui.js",
        assetFileNames: "ui.[ext]",
      },
    },
  },
});
