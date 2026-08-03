import { readFileSync } from "node:fs";

const pricing = readFileSync("src/pages/Pricing.tsx", "utf8");
const comparison = readFileSync("src/components/PricingComparison.tsx", "utf8");
const faq = readFileSync("src/components/PricingFaq.tsx", "utf8");
const entitlements = readFileSync("src/entitlements.ts", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const source = [pricing, comparison, faq, app];

const required = [
  "20 Book Wiki or Reading Lens analyses",
  "10 chapter podcasts",
  "4 recap podcasts",
  "1 monthly reading review",
  "30 Ask My Reading questions",
  "12 cross-book connection requests",
  "Payment is reviewed through the internal process",
  "Raw session text remains private to you",
  "billing?.enabled",
];
for (const text of required) if (!source.some((file) => file.includes(text))) throw new Error(`pricing truth missing: ${text}`);
if (!entitlements.includes('deep_reader: { ai_reader_generation: 20') || !entitlements.includes('podcast_chapter_generation: 10') || !entitlements.includes('ask_my_reading: 30')) throw new Error("deep reader policy contract changed; update pricing copy deliberately");
if (source.some((file) => file.includes("font-serif"))) throw new Error("sans-serif normalization incomplete");
if (pricing.includes("instant activation") || pricing.includes("Coming in a later chapter")) throw new Error("pricing contains misleading availability copy");
console.log("PRICING_CONVERSION_FIXTURES_OK");
