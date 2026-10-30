import { useVideoPlayer, VideoView } from 'expo-video';
import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { PickedMedia } from '../lib/pickMedia';

function Clip({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.play(); });
  // A TextureView respects the stage's rounded clipping and the card drawn over it; the default
  // SurfaceView on Android can render black underneath other views.
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} surfaceType="textureView" />;
}

/** The recorded or picked clip (or photo) behind the card, cropped to the 9:16 stage. */
export function Backdrop({ media }: { media: PickedMedia }) {
  return media.kind === 'photo'
    ? <Image source={{ uri: media.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
    : <Clip key={media.uri} uri={media.uri} />;
}
