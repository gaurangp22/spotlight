// Web does not request native push permissions. Keep the control explicit about its platform.
export async function registerPush() { throw new Error('Push alerts are available in the installed phone app.'); }
export function usePushNotifications() {}
