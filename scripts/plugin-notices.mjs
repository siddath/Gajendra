import { readFile } from "node:fs/promises";
import path from "node:path";

export const pluginNoticeArtifacts = [
  "THIRD_PARTY_NOTICES.md",
  "third_party_licenses/modelcontextprotocol-ext-apps-LICENSE",
  "third_party_licenses/modelcontextprotocol-client-LICENSE",
  "third_party_licenses/modelcontextprotocol-server-LICENSE",
  "third_party_licenses/modelcontextprotocol-core-LICENSE",
  "third_party_licenses/modelcontextprotocol-sdk-LICENSE",
  "third_party_licenses/gsap-LICENSE-NOTICE",
  "third_party_licenses/zod-LICENSE",
];

export async function validateBundledPluginNotices(app, pluginRoot) {
  for (const relativePath of pluginNoticeArtifacts) {
    const [source, bundled] = await Promise.all([
      readFile(path.join(pluginRoot, relativePath)),
      readFile(path.join(app, "Contents/Resources/ThirdPartyNotices", relativePath)),
    ]);
    if (source.byteLength === 0 || !bundled.equals(source)) {
      throw new Error(`Bundled dependency notice does not match source: ${relativePath}.`);
    }
  }
}
