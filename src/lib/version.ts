import app from '../../app.json';

// Read from app.json directly: on the web, Expo's runtime config reports a placeholder 1.0.0.
export const appVersion = app.expo.version;
