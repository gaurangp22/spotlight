const queries = ['Frank Ocean', 'Tyler The Creator', 'Tame Impala'];
(async () => {
  for (const query of queries) {
    const response = await fetch('https://itunes.apple.com/search?entity=album&limit=50&term=' + encodeURIComponent(query));
    const data = await response.json();
    console.log(JSON.stringify({ query, albums: data.results.map((item) => ({ title: item.collectionName, artist: item.artistName, artwork: item.artworkUrl100?.replace('100x100bb', '600x600bb') })) }));
  }
})();
