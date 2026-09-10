import assert from "node:assert/strict";
import { buildSearchDocument, normalizeLibrarySearchText, safeSearchExcerpt } from "../src/librarySearch.js";
const doc=buildSearchDocument({ownerId:"o",bookId:"b",kind:"note",sourceKey:"l",title:"A",body:"Cô đơn",pageStart:1,pageEnd:1}); assert.equal(normalizeLibrarySearchText(doc?.body),"co don"); assert.match(safeSearchExcerpt("x ".repeat(100)+"cô đơn", "co don"),/cô đơn/);
assert.match(safeSearchExcerpt("một ".repeat(60)+"miếng bánh", "banh"),/miếng bánh/);
assert.doesNotMatch(safeSearchExcerpt("một ".repeat(60)+"miếng bánh", "banh"),/…iếng/); assert.equal(buildSearchDocument({ownerId:"o",bookId:"b",kind:"note",sourceKey:"l",title:"",body:"x"}),null); console.log("LIBRARY_SEARCH_FIXTURES_OK");

import { readFileSync } from "node:fs";
const route = readFileSync(new URL("../src/routes/books.ts", import.meta.url), "utf8");
assert.match(route, /booksRouter\.get\("\/search"/); assert.match(route, /searchLibrary\(userFrom\(req\)\.id/); assert.match(route, /bestEffortUpsertSearchDocument/);

const migration = readFileSync(new URL("../migrations/20260908_add_unified_library_search.sql", import.meta.url), "utf8"); assert.match(migration,/Initial compact backfill/); assert.doesNotMatch(migration,/raw_text/);

assert.match(route, /owner_id=\$1/); assert.match(route, /kind: "book"/); assert.match(route, /kind: "reflection"/); const aiReader = readFileSync(new URL("../src/aiReader.ts", import.meta.url), "utf8"); assert.match(aiReader,/kind: "wiki"/); const story = readFileSync(new URL("../src/storyThread.ts", import.meta.url), "utf8"); assert.match(story,/kind: "story_session"/);

assert.match(story,/kind: "story_memory"/); assert.match(migration,/story_thread_analyses/); assert.match(migration,/sta\.story_recap/); assert.doesNotMatch(migration,/sta\.analysis::text/); assert.match(migration,/story_memory_snapshots/);

assert.match(route,/bestEffortUpsertSearchDocument/); assert.match(route,/kind: "quote"/); assert.match(route,/bestEffortDeleteSearchDocument/);

assert.doesNotMatch(migration,/CREATE EXTENSION|unaccent\(/);
