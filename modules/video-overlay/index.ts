import { requireOptionalNativeModule } from 'expo';

type VideoOverlayModule = {
  compose(videoUri: string, overlayUri: string): Promise<string>;
  composeTimed?(videoUri: string, overlayUris: string[], starts: number[]): Promise<string>;
};

// Absent in Expo Go and in builds made before this module was added.
const native = requireOptionalNativeModule<VideoOverlayModule>('VideoOverlay');

export const isAvailable = !!native;
/** Timed overlays (the ranking countdown) arrived in a later native build than single cards. */
export const canComposeTimed = !!native?.composeTimed;

/**
 * Burns a transparent PNG onto every frame of a video and resolves to a new file:// mp4.
 * The PNG should match the video's displayed aspect ratio; it is scaled to the exact frame size.
 */
export function compose(videoUri: string, overlayPngUri: string): Promise<string> {
  if (!native) return Promise.reject(new Error('Video reviews need the latest version of the app. Update it and try again.'));
  return native.compose(videoUri, overlayPngUri);
}

/** Burns a sequence of PNGs, each shown from its start (in seconds) until the next one begins. */
export function composeTimed(videoUri: string, overlays: { uri: string; start: number }[]): Promise<string> {
  if (!native?.composeTimed) return Promise.reject(new Error('Ranking videos need the latest version of the app. Update it and try again.'));
  return native.composeTimed(videoUri, overlays.map((o) => o.uri), overlays.map((o) => o.start));
}
