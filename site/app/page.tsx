import { covers } from './covers';

const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || '';
const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || '';
const WEB_APP_URL = process.env.NEXT_PUBLIC_WEB_APP_URL || '';

type Tone = 'loved' | 'fine' | 'nope';
const ring = (score: number): Tone => (score >= 7 ? 'loved' : score >= 4 ? 'fine' : 'nope');

function Ring({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={`ring ring-${size} ring-${ring(score)}`}>{Number.isInteger(score) ? score : score.toFixed(1)}</span>;
}

function StoreButtons({ center = false }: { center?: boolean }) {
  return <div className={`stores${center ? ' center' : ''}`}>
    <a className="store" href={IOS_URL || '#download'} aria-disabled={!IOS_URL}>
      <svg viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M16.4 12.6c0-2.4 2-3.6 2.1-3.6-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8s2.1-1.2 2.9-2.4c.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.4-.9-2.4-4zM14 5.6c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z"/></svg>
      <span><small>{IOS_URL ? 'Download on the' : 'Coming soon to the'}</small>App Store</span>
    </a>
    <a className="store" href={ANDROID_URL || '#download'} aria-disabled={!ANDROID_URL}>
      <svg viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M3.6 2.2c-.3.3-.4.7-.4 1.2v17.2c0 .5.1.9.4 1.2l9.7-9.8L3.6 2.2zm10.8 10.8 2.8 2.8-11.6 6.6 8.8-9.4zm0-2L5.6 1.6l11.6 6.6-2.8 2.8zm3.9-1.7L21 10.8c.8.5.8 1.8 0 2.3l-2.7 1.5-3.1-3.1 3.1-3.2z"/></svg>
      <span><small>{ANDROID_URL ? 'Get it for' : 'Coming soon for'}</small>Android</span>
    </a>
    {WEB_APP_URL && <a className="store ghost" href={WEB_APP_URL}><span><small>No download?</small>Open in browser</span></a>}
  </div>;
}

/** A phone frame with a stand-in "camera" (blurred album art) and the real Riffs video card on top. */
function CountdownPhone() {
  const rows = [
    { t: 'Something About Us', a: 'Daft Punk', s: 9.5, c: covers[10] },
    { t: 'Face to Face', a: 'Daft Punk', s: 9.4, c: covers[22] },
    { t: 'Voyager', a: 'Daft Punk', s: 9.3, c: covers[22] },
    { t: 'Digital Love', a: 'Daft Punk', s: 9.1, c: covers[22] },
  ];
  return <div className="phone tilt-left" aria-label="A ranking countdown video made with Riffs">
    <div className="screen camera" style={{ backgroundImage: `url(${covers[22]})` }}>
      <div className="reel-head">
        <span className="avatar">G</span><b>@gaurang22</b>
      </div>
      <h4 className="reel-title">My Discovery ranking</h4>
      <p className="reel-sub">on Riffs <img src="/riffs-mark-white.png" alt="" /></p>
      <div className="glass list">
        {[1, 2, 3].map((n) => <div key={n} className={`slot${n === 1 ? ' gold' : ''}`}><i>{n}</i></div>)}
        <div className="hot">
          <div className="by"><span className="avatar xs">G</span>@gaurang22 <em>now</em></div>
          <div className="row"><i>4</i><img src={rows[0].c} alt="" /><div><b>{rows[0].t}</b><span>{rows[0].a}</span></div><Ring score={rows[0].s} /></div>
          <q>Beautiful</q>
        </div>
        {rows.slice(1).map((r, i) => <div key={r.t} className="slot shown"><i>{i + 5}</i><img src={r.c} alt="" /><div><b>{r.t}</b><span>{r.a}</span></div><Ring score={r.s} size="sm" /></div>)}
      </div>
    </div>
  </div>;
}

function ReviewPhone() {
  return <div className="phone tilt-right" aria-label="A video review made with Riffs">
    <div className="screen camera" style={{ backgroundImage: `url(${covers[4]})` }}>
      <div className="glass review">
        <div className="by"><span className="avatar xs">A</span>@adi22 <em>now</em><img className="mark" src="/riffs-mark-white.png" alt="" /></div>
        <div className="row"><img src={covers[24] || covers[0]} alt="" /><div><b>Random Access Memories</b><span>Daft Punk · Album</span></div><Ring score={9.2} size="lg" /></div>
        <q>Daft Punk never misses</q>
      </div>
      <div className="rec"><span /> REC 0:12</div>
    </div>
  </div>;
}

const features = [
  { tag: 'Rate', title: 'Head-to-heads, not star ratings', body: 'Pick between two songs a few times and Riffs turns your gut reaction into an honest score out of 10.', visual: 'versus' },
  { tag: 'Film', title: 'Count your top 10 down on camera', body: 'Flip the camera, react, and tap to reveal each pick from #10 to #1. The ranking card is burned right into the video, ready for Reels and TikTok.', visual: 'countdown' },
  { tag: 'Match', title: 'Find your taste twins', body: 'Riffs compares how you score the same music and shows who actually hears it like you do — down to the percent.', visual: 'twins' },
  { tag: 'For you', title: 'A feed that knows you', body: 'Rate metal and see more metal. Your ratings, saves, diary, and shares shape what you see — every pick says why.', visual: 'foryou' },
  { tag: 'Bring it', title: 'Import any playlist', body: 'Paste a Spotify or Apple Music link and your songs land in Riffs, covers and all. Rank them, rate them, share them.', visual: 'import' },
  { tag: 'Talk', title: 'Clubs, takes, and DMs', body: 'Weekly album clubs, hot takes, polls, and a chat built for sending songs back and forth.', visual: 'chat' },
];

function FeatureVisual({ kind }: { kind: string }) {
  if (kind === 'versus') return <div className="fv versus"><img src={covers[2]} alt="" /><span>or</span><img src={covers[1]} alt="" /></div>;
  if (kind === 'countdown') return <div className="fv countdown">{[3, 2, 1].map((n, i) => <div key={n} className={n === 1 ? 'gold' : ''}><i>{n}</i><img src={covers[5 + i]} alt="" /><Ring score={8.6 + i * 0.4} size="sm" /></div>)}</div>;
  if (kind === 'twins') return <div className="fv twins"><span className="avatar lg">G</span><b>94%</b><span className="avatar lg alt">A</span></div>;
  if (kind === 'foryou') return <div className="fv foryou">{['Because you rated Metallica', 'More Hard Rock', 'Loved by your taste twin'].map((t, i) => <div key={t}><img src={covers[12 + i]} alt="" /><em>{t}</em></div>)}</div>;
  if (kind === 'import') return <div className="fv import"><code>open.spotify.com/playlist/…</code><div>{covers.slice(14, 19).map((c) => <img key={c} src={c} alt="" />)}</div></div>;
  return <div className="fv chat"><p className="them">have you heard the new Tame Impala?</p><p className="me">sending it rn</p><p className="them song"><img src={covers[9]} alt="" />Let It Happen</p></div>;
}

const faq = [
  ['Is Riffs free?', 'Yes. Riffs is free to use — rate, rank, film, and chat without paying anything.'],
  ['Does Riffs play music?', 'No. Riffs is where you talk about music. Songs open in the music app you already use, and short previews play where they are available.'],
  ['Do I need Spotify or Apple Music?', 'No account connection is needed. Search the whole catalog, or paste a public playlist link to bring your songs in.'],
  ['What are the bots?', 'Riffs has a few clearly labelled house bots that post daily picks and polls so the app never feels empty. You can hide them in Settings.'],
];

export default function Home() {
  const wall = [...covers, ...covers];
  return <main>
    <nav className="nav">
      <a href="#" className="brand" aria-label="Riffs home"><img src="/riffs-mark-white.png" alt="" /><img src="/riffs-wordmark.png" alt="Riffs" className="word" /></a>
      <div className="links"><a href="#features">Features</a><a href="#faq">FAQ</a><a className="cta" href="#download">Get the app</a></div>
    </nav>

    <section className="hero">
      <div className="copy">
        <p className="eyebrow"><span className="dot" /> Music, out loud</p>
        <h1>Your music taste<br />deserves a <span className="hl">mic.</span></h1>
        <p className="lede">Rate your favourite tracks, drop album reviews, and record videos featuring your ratings. Then find the people whose taste matches yours.</p>
        <StoreButtons />
        <p className="fine">Free · No music account needed · Made for Reels &amp; TikTok</p>
      </div>
      <div className="phones"><CountdownPhone /><ReviewPhone /></div>
    </section>

    <section className="wall" aria-hidden>
      <div className="track">{wall.map((c, i) => <img key={i} src={c} alt="" loading="lazy" />)}</div>
      <div className="track reverse">{wall.slice().reverse().map((c, i) => <img key={i} src={c} alt="" loading="lazy" />)}</div>
    </section>

    <section id="features" className="features">
      <h2>Everything your opinions<br />have been missing.</h2>
      <div className="grid">
        {features.map((f) => <article key={f.title} className="feature">
          <FeatureVisual kind={f.visual} />
          <p className="tag">{f.tag}</p>
          <h3>{f.title}</h3>
          <p>{f.body}</p>
        </article>)}
      </div>
    </section>

    <section className="steps">
      <h2>Three taps to your first video.</h2>
      <ol>
        <li><b>01</b><h3>Pick your top 10</h3><p>Search anything, or import a playlist. Drag them into your exact order.</p></li>
        <li><b>02</b><h3>Flip the camera</h3><p>Hit record, react, and tap Reveal for each pick, #10 up to #1.</p></li>
        <li><b>03</b><h3>Post it</h3><p>Save or share straight to Instagram, TikTok, or your group chat.</p></li>
      </ol>
    </section>

    <section id="download" className="band">
      <img src="/riffs-mark-white.png" alt="" className="band-mark" />
      <h2>Say it out loud.</h2>
      <p>Join Riffs and put your taste on the record.</p>
      <StoreButtons center />
    </section>

    <section id="faq" className="faq">
      <h2>Questions</h2>
      {faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
    </section>

    <footer className="footer">
      <div className="brand"><img src="/riffs-mark-white.png" alt="" /><img src="/riffs-wordmark.png" alt="Riffs" className="word" /></div>
      <p>Titles, names, and artwork belong to their respective owners and are shown for identification. Riffs does not stream music.</p>
      <p>© {new Date().getFullYear()} Riffs</p>
    </footer>
  </main>;
}
