const isDev = window.location.port === '4200';

console.log('[Environment] isDev:', isDev, 'origin:', window.location.origin);

export const environment = {
    production: !isDev,
    apiUrl: '/api',
    baseUrl: ''
};
