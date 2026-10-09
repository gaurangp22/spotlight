import { Asset, requestPermissionsAsync } from 'expo-media-library';

/** Saves a finished video to the photo library, asking only for write access. */
export async function saveVideoToLibrary(uri: string) {
  const permission = await requestPermissionsAsync(true, ['video']);
  if (!permission.granted) throw new Error('Allow Riffs to save to your photos in Settings, or use Share instead.');
  await Asset.create(uri);
}
