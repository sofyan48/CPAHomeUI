import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "..");
const generatedDir = resolve(rootDir, ".output/public");
const generatedAssetsDir = resolve(generatedDir, "_nuxt");
const generatedFontsDir = resolve(generatedDir, "_fonts");
const distDir = resolve(rootDir, "dist");
const assetsDir = resolve(distDir, "assets");

const rewriteEmbeddedPaths = (content) => content
  .replaceAll("/_nuxt/", "/assets/")
  .replaceAll("/_fonts/", "/assets/fonts/")
  .replaceAll("/favicon.png", "/assets/favicon.png")
  .replaceAll("/favicon.ico", "/assets/favicon.ico");

const rewriteAssetFiles = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await rewriteAssetFiles(entryPath);
      continue;
    }
    if (![".css", ".js", ".json", ".map"].includes(extname(entry.name))) continue;
    const content = await readFile(entryPath, "utf8");
    const rewritten = rewriteEmbeddedPaths(content);
    if (rewritten !== content) await writeFile(entryPath, rewritten);
  }
};

await rm(distDir, { recursive: true, force: true });
await mkdir(assetsDir, { recursive: true });
await cp(generatedAssetsDir, assetsDir, { recursive: true });
await cp(generatedFontsDir, resolve(assetsDir, "fonts"), { recursive: true });
await cp(resolve(generatedDir, "favicon.png"), resolve(assetsDir, "favicon.png"));
await cp(resolve(generatedDir, "favicon.ico"), resolve(assetsDir, "favicon.ico"));
await rewriteAssetFiles(assetsDir);

const sourceHTML = await readFile(resolve(generatedDir, "index.html"), "utf8");
const embeddedHTML = rewriteEmbeddedPaths(sourceHTML);

await Promise.all([
  writeFile(resolve(distDir, "index.html"), embeddedHTML),
  writeFile(resolve(distDir, "management.html"), embeddedHTML),
  writeFile(resolve(distDir, "user.html"), embeddedHTML),
]);
