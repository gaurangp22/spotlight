export const isAvailable = false;

export function compose(_videoUri: string, _overlayPngUri: string): Promise<string> {
  return Promise.reject(new Error('Video reviews are recorded in the phone app.'));
}
