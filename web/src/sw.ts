/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, PrecacheController, PrecacheRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

const stripVaryStarPlugin = {
  cacheWillUpdate: async ({ request, response, event }: { request: Request; response: Response | null | undefined; event?: ExtendableEvent }) => {
    if (!response || response.status !== 200) return null;

    const contentType = (response.headers.get('Content-Type') ?? '').toLowerCase();

    // Avoid caching SPA HTML under non-HTML asset keys.
    if (contentType.includes('text/html')) {
      const pathname = new URL(request.url).pathname;
      if (!pathname.endsWith('.html') && pathname !== '/') return null;
    }

    // Cache API rejects responses with "Vary: *"; strip it during precache install.
    if (response.headers.get('Vary')?.includes('*')) {
      if (event?.type === 'install') {
        const headers = new Headers(response.headers);
        headers.delete('Vary');
        headers.delete('Content-Length');
        headers.delete('Content-Encoding');
        return new Response(await response.arrayBuffer(), {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
      return null;
    }

    return response;
  },
};

const precacheController = new PrecacheController({
  plugins: [stripVaryStarPlugin],
});
precacheController.addToCacheList(self.__WB_MANIFEST);

self.addEventListener('install', event => {
  (event as ExtendableEvent).waitUntil(precacheController.install(event as ExtendableEvent));
});

self.addEventListener('activate', event => {
  (event as ExtendableEvent).waitUntil(precacheController.activate(event as ExtendableEvent));
});

registerRoute(new PrecacheRoute(precacheController));

registerRoute(
  new NavigationRoute(
    async () => {
      const cached = await precacheController.matchPrecache('/index.html');
      if (cached) return cached;

      try {
        return await fetch('/index.html');
      } catch {
        return new Response(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title></head>'
          + '<body style="font-family:sans-serif;text-align:center;margin-top:80px">'
          + '<h2>Offline</h2><p>Please reconnect and refresh.</p></body></html>',
          { status: 503, headers: { 'Content-Type': 'text/html;charset=utf-8' } },
        );
      }
    },
    { allowlist: [/^\/$/] },
  ),
);

// Runtime cache whitelist: image resources only.
// 1) /api/upload/:hash[.ext]
// 2) /api/upload/proxy?type=resource
registerRoute(
  ({ url, request }) => {
    if (url.origin !== self.location.origin || request.mode === 'navigate') return false;

    const isHashFile = /^\/api\/upload\/[a-f0-9]{32}(\.[a-z0-9]+)?$/i.test(url.pathname);
    const isProxyImageResource = url.pathname === '/api/upload/proxy' && url.searchParams.get('type') === 'resource';

    return isHashFile || isProxyImageResource;
  },
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      stripVaryStarPlugin,
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 5,
      }),
      {
        handlerDidError: async () =>
          new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }),
      },
    ],
  }),
);
