import type { Plugin } from "vite";

/** Bundle Gajendra's one fixed HTML entry without a glob-pattern dependency. */
export function inlineUi(): Plugin {
  return {
    name: "gajendra:inline-ui",
    enforce: "post",
    generateBundle(_options, bundle) {
      const html = bundle["gajendra.html"];
      const script = bundle["ui.js"];
      const css = bundle["ui.css"];
      if (!html || html.type !== "asset" || typeof html.source !== "string"
        || !script || script.type !== "chunk" || !css || css.type !== "asset"
        || Object.keys(bundle).some((name) => !["gajendra.html", "ui.js", "ui.css"].includes(name))) {
        this.error("Expected one Gajendra HTML entry and its fixed JS/CSS bundles.");
      }

      const scriptTag = /<script([^>]*?) src="\.\/ui\.js"([^>]*)><\/script>/gu;
      const styleTag = /<link([^>]*?) href="\.\/ui\.css"([^>]*)>/gu;
      if (html.source.match(scriptTag)?.length !== 1 || html.source.match(styleTag)?.length !== 1) {
        this.error("Gajendra HTML must reference each UI bundle exactly once.");
      }

      // Keep embedded code from closing its HTML raw-text element. Preserve attributes,
      // module-loader behavior and the separately built server already on disk.
      const code = script.code.replace(/<(\/script\b|!--)/giu, "\\x3C$1").trim();
      const cssText = typeof css.source === "string" ? css.source : new TextDecoder().decode(css.source);
      const styles = cssText.replace(/@charset "UTF-8";/gu, "").replace(/<(\/style\b)/giu, "\\3C $1").trim();
      html.source = html.source
        .replace(scriptTag, (_tag, before: string, after: string) => `<script${before}${after}>${code}</script>`)
        .replace(styleTag, (_tag, before: string, after: string) => `<style${before}${after}>${styles}</style>`);
      delete bundle["ui.js"];
      delete bundle["ui.css"];
    },
  };
}
