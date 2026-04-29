/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, PrecacheController, PrecacheRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

/**
 * Plugin that handles responses whose `Vary` header contains `*`.
 *
 * The browser's Cache API hard-rejects `cache.put()` with "Vary header
 * contains *".  Workbox v7 precaching also throws `bad-precaching-response`
 * when a precache entry is not written (i.e. returning null is NOT safe for
 * precaching).  The fix: strip the `Vary: *` header from the response clone
 * so the Cache API accepts it, instead of skipping the write.
 *
 * For runtime caching (NetworkFirst), responses with bad status are still
 * rejected via `return null`.
 */
const stripVaryStarPlugin = {
  cacheWillUpdate: async ({ response }: { response: Response | null | undefined }) => {
    if (!response || response.status !== 200) return null;
    if (response.headers.get('Vary')?.includes('*')) {
      const headers = new Headers(response.headers);
      headers.delete('Vary');
      return new Response(await response.arrayBuffer(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    return response;
  },
};

// Use PrecacheController directly so the plugin is applied during the SW
// install phase (precaching static assets), not only at runtime.
const precacheController = new PrecacheController({
  plugins: [stripVaryStarPlugin],
});
precacheController.addToCacheList(self.__WB_MANIFEST);

self.addEventListener('install', event => {
  (event as ExtendableEvent).waitUntil(
    precacheController.install(event as ExtendableEvent),
  );
});

self.addEventListener('activate', event => {
  (event as ExtendableEvent).waitUntil(
    precacheController.activate(event as ExtendableEvent),
  );
});

registerRoute(new PrecacheRoute(precacheController));

// Runtime caching for API requests – also skips Vary: * responses.
registerRoute(
  /^https:\/\/.*\/.*/i,
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      stripVaryStarPlugin,
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 7,
      }),
    ],
  }),
);
