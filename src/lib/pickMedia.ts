import * as ImagePicker from 'expo-image-picker';

export type PickedMedia = { uri: string; kind: 'photo' | 'video'; seconds?: number };

/**
 * Lets someone use a photo or video they already have instead of recording. Videos longer than
 * `maxSeconds` are refused with a message asking for a shorter one.
 */
export async function pickMedia(maxSeconds: number): Promise<PickedMedia | null> {
  // Compatible: iOS hands back H.264 instead of HEVC, which every exporter and player can read.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'], quality: 0.9,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  if (asset.type === 'video' || asset.type === 'pairedVideo') {
    const seconds = asset.duration ? asset.duration / 1000 : undefined;
    if (seconds && seconds > maxSeconds + 1) throw new Error(`Pick a video under ${maxSeconds} seconds, or trim it in your gallery first.`);
    return { uri: asset.uri, kind: 'video', seconds };
  }
  return { uri: asset.uri, kind: 'photo' };
}
