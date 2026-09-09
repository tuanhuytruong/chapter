import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

export type ManifestEntry = { file: string; imports?: string[]; dynamicImports?: string[]; isEntry?: boolean };
export type Manifest = Record<string, ManifestEntry>;
export type AssetSize = { raw: number; gzip: number; brotli: number };

export function readManifest(distDir = path.resolve("dist")): Manifest {
  const manifestPath = path.join(distDir, ".vite", "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error("Missing dist/.vite/manifest.json. Run npm run build first.");
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;
}

export function sizeForFile(distDir: string, file: string): AssetSize {
  const bytes = fs.readFileSync(path.join(distDir, file));
  return { raw: bytes.length, gzip: zlib.gzipSync(bytes, { level: 9 }).length, brotli: zlib.brotliCompressSync(bytes).length };
}

export function resolveManifestKey(manifest: Manifest, sourceKey: string): string {
  if (manifest[sourceKey]) return sourceKey;
  const basename = sourceKey.split("/").pop()?.replace(/\.tsx?$/, "") || sourceKey;
  const found = Object.entries(manifest).find(([key, entry]) => key.includes(basename) || (entry as ManifestEntry & { src?: string }).src === sourceKey);
  if (!found) throw new Error(`Manifest entry missing: ${sourceKey}`);
  return found[0];
}

export function closure(manifest: Manifest, key: string): string[] {
  key = resolveManifestKey(manifest, key);
  const visited = new Set<string>();
  const visit = (entryKey: string) => {
    if (visited.has(entryKey)) return;
    const entry = manifest[entryKey];
    if (!entry) throw new Error(`Manifest import missing: ${entryKey}`);
    visited.add(entryKey);
    for (const imported of entry.imports || []) visit(imported);
  };
  visit(key);
  return [...visited];
}

export function sumEntries(distDir: string, manifest: Manifest, keys: string[]): AssetSize {
  const files = new Set(keys.map((key) => manifest[key]?.file).filter((value): value is string => Boolean(value)));
  return [...files].reduce<AssetSize>((total, file) => {
    const size = sizeForFile(distDir, file);
    return { raw: total.raw + size.raw, gzip: total.gzip + size.gzip, brotli: total.brotli + size.brotli };
  }, { raw: 0, gzip: 0, brotli: 0 });
}

export function allJavaScriptFiles(distDir: string): string[] {
  const assetsDir = path.join(distDir, "assets");
  if (!fs.existsSync(assetsDir)) return [];
  return fs.readdirSync(assetsDir).filter((file) => file.endsWith(".js"));
}
