import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [app, shell, header, profile, pricing] = await Promise.all([read("src/App.tsx"), read("src/components/AppShell.tsx"), read("src/components/PageHeader.tsx"), read("src/pages/Profile.tsx"), read("src/pages/Pricing.tsx")]);
assert.match(app, /import AppShell from ['"]\.\/components\/AppShell['"]/);
assert.match(app, /<Route element=\{<AppShell \/>}>/);
assert.match(shell, /max-w-7xl flex-1 px-3 py-5 sm:px-6 sm:py-8 lg:px-8/, "AppShell must retain responsive content gutters");
assert.match(shell, /sticky top-0 z-40/, "AppShell must retain sticky header");
assert.match(shell, /JourneyDrawer open=\{journeyOpen\}/, "AppShell must retain Journey drawer");
assert.match(shell, /sm:hidden/, "AppShell must retain mobile navigation");
assert.match(header, /<h1 className=\{titleClassName\}>\{title\}<\/h1>/, "PageHeader must render an h1");
assert.match(header, /flex flex-wrap items-center gap-3/, "PageHeader actions must wrap");
assert.match(profile, /<PageHeader eyebrow="Profile"/, "Profile must use PageHeader");
assert.match(pricing, /<PageHeader className="relative max-w-3xl" eyebrow="Membership"/, "Pricing must use PageHeader");
console.log("UI foundation source contract verified.");
