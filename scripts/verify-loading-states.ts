#!/usr/bin/env node
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const detail = read("../src/pages/BookDetail.tsx");
const pricing = read("../src/pages/Pricing.tsx");
const skeleton = read("../src/components/ContentSkeleton.tsx");
const upgradeCard = read("../src/components/ContextualUpgradeCard.tsx");

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

assert(skeleton.includes("export function BookDetailSkeleton"), "missing Book Detail skeleton");
assert(skeleton.includes("export function PricingSkeleton"), "missing Pricing skeleton");
assert(skeleton.includes("Loading book details"), "Book Detail skeleton needs loading text");
assert(skeleton.includes("Loading membership options"), "Pricing skeleton needs loading text");
assert(skeleton.includes("motion-reduce:animate-none"), "skeleton animation must respect reduced motion");
assert(detail.includes("return <BookDetailSkeleton />;"), "Book Detail must use layout skeleton while primary data loads");
assert(pricing.includes("return <PricingSkeleton />;"), "Pricing must use card-shaped skeleton while catalog loads");
assert(detail.includes("const previousPrompt = upgradePrompt;"), "dismiss must retain the prior prompt");
assert(detail.includes("setUpgradePrompt(null);"), "dismiss should optimistically hide only the prompt card");
assert(detail.includes("setUpgradePrompt(previousPrompt);"), "failed dismissal must restore the exact prompt");
assert(detail.includes("setUpgradeDismissError"), "failed dismissal needs scoped retry feedback");
assert(upgradeCard.includes("disabled={dismissing}"), "dismiss control must lock during write");
assert(upgradeCard.includes("focus-visible:ring-2"), "dismiss control needs focus-visible styling");
assert(!upgradeCard.includes("if (dismissing) return null"), "card must stay mounted during pending dismissal");

console.log("C3_LOADING_AND_PROMPT_CONTRACT_OK");
