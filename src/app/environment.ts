/**
 * Shared API configuration.
 * In development (port 4200), connects directly to backend on port 3000.
 * In production (served via Nginx), uses relative URLs through the reverse proxy.
 */
const isDev = window.location.port === '4200';
const baseUrl = isDev ? `http://${window.location.hostname}:3000` : '';

export const environment = {
    production: !isDev,
    apiUrl: `${baseUrl}/api`,
    baseUrl: baseUrl
};
