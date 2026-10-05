export function postLink(id: string) {
  const web = process.env.EXPO_PUBLIC_WEB_URL;
  return web ? `${web.replace(/\/$/, '')}/ranking/${id}` : `marginmusic://ranking/${id}`;
}
