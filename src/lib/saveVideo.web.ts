// expo-media-library has no web implementation; importing it on web crashes the whole bundle.
export async function saveVideoToLibrary(_uri: string): Promise<void> {
  throw new Error('Saving videos works in the Riffs app on your phone.');
}
