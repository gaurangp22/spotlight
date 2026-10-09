import { requireOptionalNativeModule } from 'expo';

type VideoOverlayModule = { compose(videoUri: string, overlayUri: string): Promise<string> };

// Absent in Expo Go and in builds made before this module was added.
const native = requireOptionalNativeModule<VideoOverlayModule>('VideoOverlay');

export const isAvailable = !!native;

/**
 * Burns a transparent PNG onto every frame of a video and resolves to a new file:// mp4.
 * The PNG should match the video's displayed aspect ratio; it is scaled to the exact frame size.
 */
export function compose(videoUri: string, overlayPngUri: string): Promise<string> {
  if (!native) return Promise.reject(new Error('Video reviews need the latest version of the app. Update it and try again.'));
  return native.compose(videoUri, overlayPngUri);
}
