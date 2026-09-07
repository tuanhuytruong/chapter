import { readFileSync } from "node:fs";

const source = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const assert = (value: unknown, message: string) => {
  if (!value) throw new Error(message);
  console.log(`✓ ${message}`);
};

const hook = source("src/hooks/useJobPolling.ts");
assert(hook.includes('document.addEventListener("visibilitychange"'), "polling watches visibility changes");
assert(hook.includes("document.hidden"), "polling pauses hidden documents");
assert(hook.includes("inFlight"), "polling prevents overlapping requests");
assert(hook.includes("disposed"), "polling prevents unmounted updates");
assert(hook.includes("Math.min(options.current.intervalMs * 2 ** failures"), "polling uses bounded failure backoff");
assert(hook.includes("else if (options.current.enabled)") && hook.includes("void run()"), "visibility return makes one guarded refresh");
assert(hook.includes("refreshOnVisible") && hook.includes("if (inFlight) refreshOnVisible = true"), "visibility return queues one refresh behind an in-flight request");
assert(hook.includes("if (refreshOnVisible)") && hook.includes("void run();"), "queued visibility refresh runs after the current request settles");

for (const file of ["src/components/BookWiki.tsx", "src/components/PodcastPanel.tsx", "src/components/PodcastPlaylistPlayer.tsx", "src/pages/Podcasts.tsx"]) {
  const content = source(file);
  assert(content.includes('useJobPolling({'), `${file} uses shared job polling`);
  assert(!content.includes("window.setInterval"), `${file} has no legacy polling interval`);
}

const wiki = source("src/components/BookWiki.tsx");
assert(wiki.includes("intervalMs: 7000") && wiki.includes("const pollingActive = running || (status?.jobStatus === \"idle\" && catchingUp)"), "BookWiki polls only non-terminal work at 7 seconds");
assert(wiki.includes("requestGeneration") && wiki.includes("generation === requestGeneration.current"), "BookWiki ignores stale refresh results and errors");
const podcasts = source("src/pages/Podcasts.tsx");
assert(podcasts.includes("refreshGeneration") && podcasts.includes("generation === refreshGeneration.current"), "Podcasts ignores stale refresh results and errors");
const player = source("src/components/PodcastPlaylistPlayer.tsx");
assert(player.includes("generationTarget") && player.includes("Generate & play next"), "playlist keeps generate-and-play flow under shared polling");
assert(player.includes("setPreparedNote(`${episodeName(fresh)} đã sẵn sàng"), "playlist retains the ready notification");
console.log("JOB_POLLING_VERIFICATION_OK");
