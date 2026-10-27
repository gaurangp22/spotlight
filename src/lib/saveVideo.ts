import { Asset, requestPermissionsAsync } from 'expo-media-library';

/** Saves a finished video (or a photo made from one) to the photo library, asking only for write access. */
export async function saveVideoToLibrary(uri: string, kind: 'video' | 'photo' = 'video') {
  const permission = await requestPermissionsAsync(true, [kind]);
  if (!permission.granted) throw new Error('Allow Riffs to save to your photos in Settings, or use Share instead.');
  await Asset.create(uri);
}
