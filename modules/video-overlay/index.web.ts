export const isAvailable = false;
export const canComposeTimed = false;

export function compose(_videoUri: string, _overlayPngUri: string): Promise<string> {
  return Promise.reject(new Error('Video reviews are recorded in the phone app.'));
}

export function composeTimed(_videoUri: string, _overlays: { uri: string; start: number }[]): Promise<string> {
  return Promise.reject(new Error('Ranking videos are recorded in the phone app.'));
}
