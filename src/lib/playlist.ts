/** Export CSV (including quoted commas) or one Song | Artist / Song - Artist per line. */
export function parseTrackList(input: string) {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i <= input.length; i++) {
    const char = input[i] || '\n';
    if (char === '"') { if (quoted && input[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && char === ',') { row.push(cell.trim()); cell = ''; }
    else if (!quoted && char === '\n') { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else if (char !== '\r') cell += char;
  }
  const header = rows[0]?.map((value) => value.toLowerCase()) || [];
  const titleIndex = header.findIndex((value) => ['track name', 'song', 'title', 'track'].includes(value));
  const artistIndex = header.findIndex((value) => ['artist name(s)', 'artist name', 'artist', 'artists'].includes(value));
  const data = titleIndex >= 0 ? rows.slice(1) : rows;
  return data.slice(0, 100).map((cells) => {
    if (titleIndex >= 0) return { title: cells[titleIndex] || '', artist: cells[artistIndex] || '' };
    if (cells.length > 1) return { title: cells[0], artist: cells[1] };
    const parts = cells[0].split(/\s+\|\s+|\s+[–—-]\s+/); return { title: parts[0], artist: parts.slice(1).join(' - ') };
  }).filter((row) => !!row.title).map((row) => ({ title: row.title.slice(0, 300), artist: row.artist.slice(0, 300) }));
}
