import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/Library.tsx', import.meta.url), 'utf8');

assert.match(source, /type Filter = 'all' \| 'active' \| 'queued' \| 'paused' \| 'finished';/);
assert.match(source, /useState<Filter>\('active'\)/);
assert.match(source, /\{ id: 'queued', label: 'Queue' \}/);
assert.match(source, /\{ id: 'all', label: 'All' \}/);
assert.match(source, /filter === 'all' \? book\.status !== 'queued' : book\.status === filter/);
assert.match(source, /scope === 'mine' && filter === 'queued'/);
assert.match(source, /Explore readers/);
assert.match(source, /Back to my shelf/);
assert.match(source, /scope === 'mine' \|\| item\.id !== 'queued'/);
assert.match(source, /aria-label="Shelf filters"/);
assert.match(source, /overflow-x-auto whitespace-nowrap/);
assert.match(source, /setFilter\('active'\)/);
assert.match(source, /function moveQueuedBook|const moveQueuedBook/);
assert.doesNotMatch(source, /\/\* ── Personal reading queue ── \*\//);

console.log('LIBRARY_SHELF_SWITCHER_FIXTURES_OK');
