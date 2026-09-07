#!/usr/bin/env node
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const css = await read("src/index.css");
const bookDetail = await read("src/pages/BookDetail.tsx");
const playlistPlayer = await read("src/components/PodcastPlaylistPlayer.tsx");

const motionRange = "(?:1[4-9]\\d|20\\d|21\\d|220)ms";
const motionDeclaration = /(?:animation|transition)(?:-[\w-]+)?\s*:/i;
const forbiddenAnimatedProperty = /(?:^|[;{\s])(?:filter|backdrop-filter)\s*:/i;
const allowedMotionProperty = /^(?:opacity|transform)$/;

const reducedMotion = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*)\n\}/);
assert(reducedMotion, "CSS must provide a prefers-reduced-motion override");
assert.match(reducedMotion[1], /animation-duration:\s*0\.01ms\s*!important/i, "reduced motion must suppress animations");
assert.match(reducedMotion[1], /transition-duration:\s*0\.01ms\s*!important/i, "reduced motion must suppress transitions");
assert.match(reducedMotion[1], /scroll-behavior:\s*auto\s*!important/i, "reduced motion must disable smooth scrolling");

const motionVariables = ["--motion-fast", "--motion-standard"];
for (const variable of motionVariables) {
  assert.match(css, new RegExp(`${variable}:\\s*${motionRange}`), `${variable} must stay within the 140–220ms calm-motion range`);
}

const blockAt = (source: string, openingBrace: number) => {
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(openingBrace + 1, index);
  }
  throw new Error("Unclosed CSS block");
};

for (const match of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
  const [header, name] = match;
  const body = blockAt(css, (match.index ?? 0) + header.length - 1);
  assert(!forbiddenAnimatedProperty.test(body), `${name} must not animate filter or backdrop-filter`);
  for (const declaration of body.matchAll(/([\w-]+)\s*:/g)) {
    assert(allowedMotionProperty.test(declaration[1]), `${name} may animate only opacity or transform, not ${declaration[1]}`);
  }
}

const guardedSelectors = ["journey-drawer", "route-content", "motion-menu", "motion-tab-panel"];
for (const selector of guardedSelectors) {
  const rules = css.split("}").filter((rule) => rule.includes(selector) && motionDeclaration.test(rule));
  assert(rules.length > 0, `${selector} must retain an explicit motion rule`);
  for (const rule of rules) {
    assert(!forbiddenAnimatedProperty.test(rule), `${selector} must not animate filter or backdrop-filter`);
    const transition = rule.match(/transition\s*:\s*([^;}]*)/i)?.[1] ?? "";
    for (const item of transition.split(",").map((value) => value.trim()).filter(Boolean)) {
      const property = item.split(/\s+/)[0];
      assert(allowedMotionProperty.test(property), `${selector} may transition only opacity or transform, not ${property}`);
    }
  }
}

assert(!/\b(?:animation|transition)(?:-[\w-]+)?\s*:[^;}]*\b(?:filter|backdrop-filter)\b/i.test(css), "CSS must not introduce filter or backdrop-filter animation");
assert.match(bookDetail, /fixed\s+bottom-\[calc\(env\(safe-area-inset-bottom\)\+1rem\)\][\s\S]*?sm:bottom-6/, "the fixed reading action must use a safe mobile bottom offset and responsive desktop offset");
assert(!/\bfixed\b/.test(playlistPlayer), "no fixed playlist player exists to require a bottom safe-area rule");

console.log("LAYOUT_PERFORMANCE_CONTRACT_OK");
