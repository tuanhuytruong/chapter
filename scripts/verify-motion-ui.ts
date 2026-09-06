import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");
const requireText = (path: string, text: string) => {
  if (!source(path).includes(text)) throw new Error(`${path} is missing ${text}`);
};

for (const token of ["--motion-fast", "--motion-standard", ".motion-menu", ".motion-tab-panel", "prefers-reduced-motion", "opacity", "transform"]) {
  requireText("src/index.css", token);
}
for (const token of ["requestAnimationFrame", "prefers-reduced-motion", "clearTimeout", "exitMs"]) {
  requireText("src/hooks/usePresence.ts", token);
}
for (const token of ["usePresence", "mobile-account-menu", "aria-controls", "Escape", "motion-menu"]) {
  requireText("src/components/AppShell.tsx", token);
}
for (const token of ["role=\"tablist\"", "role=\"tabpanel\"", "motion-tab-panel", "hasOpenedAiReader", "createPortal("]) {
  requireText("src/pages/BookDetail.tsx", token);
}

console.log("motion UI source contract: PASS");
