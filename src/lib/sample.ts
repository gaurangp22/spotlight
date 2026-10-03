import { MusicItem, Ranking } from './types';

// Public artwork URLs returned by Apple's iTunes Search API. Text covers remain the offline fallback.
const art = {
  rainbows: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg',
  computer: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg',
  kid: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/bd/8e/13/bd8e1358-b367-a689-cb84-cebd0b067dc4/634904078263.png/600x600bb.jpg',
  melodrama: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/58/11/b1/5811b172-e180-25a6-69e6-4385fbbfb5dc/17UM1IM02207.rgb.jpg/600x600bb.jpg',
};

const radiohead: MusicItem[] = [
  { id: 'sample-weird-fishes', title: 'Weird Fishes / Arpeggi', artist: 'Radiohead', album: 'In Rainbows', kind: 'song', artwork: art.rainbows, color: '#777e65' },
  { id: 'sample-nude', title: 'Nude', artist: 'Radiohead', album: 'In Rainbows', kind: 'song', artwork: art.rainbows, color: '#b97968' },
  { id: 'sample-reckoner', title: 'Reckoner', artist: 'Radiohead', album: 'In Rainbows', kind: 'song', artwork: art.rainbows, color: '#88778b' },
  { id: 'sample-paranoid-android', title: 'Paranoid Android', artist: 'Radiohead', album: 'OK Computer', kind: 'song', artwork: art.computer, color: '#648d9c' },
  { id: 'sample-how-to-disappear', title: 'How to Disappear Completely', artist: 'Radiohead', album: 'Kid A', kind: 'song', artwork: art.kid, color: '#9b9b8d' },
];

const albums: MusicItem[] = [
  { id: 'sample-in-rainbows', title: 'In Rainbows', artist: 'Radiohead', kind: 'album', artwork: art.rainbows, color: '#b96950' },
  { id: 'sample-blonde', title: 'Blonde', artist: 'Frank Ocean', kind: 'album', color: '#739973' },
  { id: 'sample-melodrama', title: 'Melodrama', artist: 'Lorde', kind: 'album', artwork: art.melodrama, color: '#49658c' },
  { id: 'sample-igor', title: 'IGOR', artist: 'Tyler, The Creator', kind: 'album', color: '#c7869d' },
  { id: 'sample-currents', title: 'Currents', artist: 'Tame Impala', kind: 'album', color: '#865779' },
];

export const sampleRankings: Ranking[] = [
  {
    id: 'sample-radiohead', title: 'The Radiohead songs I keep returning to',
    subtitle: 'Five songs, one impossible order.', author: 'Mandi', handle: '@mandi',
    items: radiohead, createdAt: 'Today', visibility: 'public', reactionCount: 24,
    comments: [{ id: 'sample-comment', author: 'Ayush', text: 'Reckoner at three is a brave choice.', itemId: 'sample-reckoner' }],
    isSample: true,
  },
  {
    id: 'sample-albums', title: 'Albums that changed my wiring',
    subtitle: 'No skips. No explanations.', author: 'Ayush', handle: '@ayush',
    items: albums, createdAt: 'Yesterday', visibility: 'public', reactionCount: 18,
    comments: [], isSample: true,
  },
];

export const sampleMusic = [...radiohead, ...albums];
