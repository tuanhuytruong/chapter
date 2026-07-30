import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const api = readFileSync(new URL('../src/api.ts', import.meta.url), 'utf8');
const library = readFileSync(new URL('../src/pages/Library.tsx', import.meta.url), 'utf8');
const quotes = readFileSync(new URL('../src/pages/Quotes.tsx', import.meta.url), 'utf8');
const wall = readFileSync(new URL('../src/components/QuoteWall.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

assert.match(server, /const limit = Number\.isFinite\(requestedLimit\) \? Math\.min\(24, Math\.max\(1, requestedLimit\)\) : 12/);
assert.match(server, /b\.owner_id=\$1/);
assert.match(server, /LIMIT \$\$\{params\.length \+ 1\} OFFSET \$\$\{params\.length \+ 2\}/);
assert.match(server, /rl\.quote ILIKE/);
assert.match(api, /getQuotes: \(query: QuoteQuery = \{\}\)/);
assert.match(api, /export interface QuotePage/);
assert.match(library, /Explore readers/);
assert.match(library, /aria-label="Shelf filters"/);
assert.match(library, /<QuoteWall \/>/);
assert.doesNotMatch(library, /<div className="flex items-center gap-3">\s*\{scope === 'mine'.*Explore readers/s);
assert.match(wall, /limit: 3/);
assert.match(wall, /Lines to return to/);
assert.doesNotMatch(wall, /columns-1/);
assert.match(quotes, /const PAGE_SIZE = 12/);
assert.match(quotes, /Load more/);
assert.match(app, /<Route path="\/quotes" element=\{<Quotes \/>\} \/>/);

console.log('QUOTES_ARCHIVE_FIXTURES_OK');
