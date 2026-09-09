#!/usr/bin/env node
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../src/App.tsx");
const skeleton = read("../src/components/ContentSkeleton.tsx");
const library = read("../src/pages/Library.tsx");
const bookCard = read("../src/components/BookCard.tsx");
const today = read("../src/pages/Today.tsx");
const detail = read("../src/pages/BookDetail.tsx");

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

for (const [component, page] of [["Library", "Library"], ["Today", "Today"]]) {
  assert(app.includes(`const ${component} = lazy(() => import('./pages/${page}'));`), `${component} must be route-lazy`);
  assert(!app.includes(`import ${component} from './pages/${page}';`), `${component} must not be eagerly imported`);
}

const lazyRoutes = [
  ["BookDetail", "BookDetail"], ["Insights", "Insights"], ["Review", "Review"],
  ["ReadingCalendar", "Calendar"], ["Momentum", "Momentum"], ["Streaks", "Streaks"], ["Achievements", "Achievements"],
  ["Profile", "Profile"], ["Account", "Account"], ["Pricing", "Pricing"], ["Quotes", "Quotes"], ["Help", "Help"],
];
for (const [component, page] of lazyRoutes) {
  assert(app.includes(`const ${component} = lazy(() => import('./pages/${page}'));`), `${component} must be route-lazy`);
  assert(!app.includes(`import ${component} from './pages/${page}';`), `${component} must not be eagerly imported`);
}

assert(app.includes("<Suspense fallback={<RouteContentSkeleton />}>"), "secondary routes must suspend with the route fallback");
assert(skeleton.includes("export function RouteContentSkeleton()"), "missing layout-matched route fallback");
assert(skeleton.includes('aria-busy="true"') && skeleton.includes('aria-live="polite"'), "route fallback must announce loading state");
assert(skeleton.includes("Loading page content"), "route fallback must provide screen-reader loading text");
assert(skeleton.includes("<ContentSkeleton"), "route fallback must reuse ContentSkeleton");

assert(bookCard.includes("lazyCover?: boolean"), "book card needs an explicit below-fold cover policy");
assert(bookCard.includes('loading: "lazy" as const') && bookCard.includes('decoding: "async" as const'), "below-fold book cards must lazy-load and decode asynchronously");
assert(library.includes("lazyCover={index >= 6}"), "library must defer covers after the first viewport row");
assert(today.includes('fetchPriority="high"'), "active Today cover must remain prioritized");
assert(detail.includes('fetchPriority="high"'), "active book-detail cover must remain prioritized");

console.log("ROUTE_IMAGE_PERFORMANCE_CONTRACT_OK");
