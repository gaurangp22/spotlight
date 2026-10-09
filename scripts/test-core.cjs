const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('src/lib/compare.ts', 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleShim = { exports: {} };
new Function('module', 'exports', output)(moduleShim, moduleShim.exports);
const { compareRankings } = moduleShim.exports;
const items = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, title: id, artist: 'Example', kind: 'song' }));
assert.equal(compareRankings(items, items).agreement, 100);
assert.equal(compareRankings(items, items).biggest, null);
assert.equal(compareRankings(items, [...items].reverse()).agreement, 0);
assert.equal(compareRankings(items, []).agreement, 0);
assert.equal(compareRankings(items, [items[0], items[1]]).agreement, 100);
assert.equal(compareRankings(items, [items[1], items[0]]).agreement, 0);
assert.equal(compareRankings(items, [...items.slice(0, 3), { id: 'other' }]).common, 3);
console.log('Comparison checks passed: identical, reversed, empty, and partial-overlap rankings.');

const playlistOutput = ts.transpileModule(fs.readFileSync('src/lib/playlist.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const playlistShim = { exports: {} };
new Function('module', 'exports', playlistOutput)(playlistShim, playlistShim.exports);
const { parseTrackList } = playlistShim.exports;
assert.deepEqual(parseTrackList('No Surprises | Radiohead\nNights - Frank Ocean'), [{ title: 'No Surprises', artist: 'Radiohead' }, { title: 'Nights', artist: 'Frank Ocean' }]);
assert.deepEqual(parseTrackList('Track URI,Track Name,Artist Name(s)\nspotify:track:1,"Hello, Goodbye","The Beatles"'), [{ title: 'Hello, Goodbye', artist: 'The Beatles' }]);
assert.equal(parseTrackList(Array.from({ length: 150 }, (_, i) => `Song ${i} | Artist`).join('\n')).length, 100);
console.log('Playlist parsing checks passed: pasted rows, quoted export CSV, and 100-track limit.');

// Rating game: binary insertion places a new item correctly against any best-first list.
const scoringSource = ts.transpileModule(fs.readFileSync('src/lib/scoring.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const scoringShim = { exports: {} };
new Function('module', 'exports', scoringSource)(scoringShim, scoringShim.exports);
const { answer, isSettled, pivot, startInsertion, tierScores, comparisonsLeft } = scoringShim.exports;
for (let count = 0; count <= 40; count++) {
  for (let target = 0; target <= count; target++) {
    // The list holds strengths count..1 (best first); the new item belongs at index `target`.
    let state = startInsertion(count), steps = 0;
    while (!isSettled(state)) { state = answer(state, pivot(state) >= target ? 'better' : 'worse'); steps++; }
    assert.equal(state.lo, target, `count ${count}, target ${target}`);
    assert.ok(steps <= Math.ceil(Math.log2(count + 1)), `too many comparisons for ${count}`);
  }
}
assert.equal(answer(startInsertion(9), 'tie').lo, 4);
assert.equal(comparisonsLeft(startInsertion(0)), 0);
assert.deepEqual(tierScores(2, 2), [10, 8.4]);
console.log('Rating game checks passed: insertion lands exactly, within log2(n) comparisons.');
