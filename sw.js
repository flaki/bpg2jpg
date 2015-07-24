console.log("service worker starting up");
var Module = {};
importScripts('bpg2jpg.js');


self.addEventListener('install', function(event) {
  // pre cache a load of stuff:
  event.waitUntil(
    caches.open('static').then(function(cache) {
      return cache.addAll([
        'test-sw.html'
      ]);
    })
  );

  console.log("service worker installed");
});


self.addEventListener('activate', function(event) {
  console.log("service worker activated");
});


self.addEventListener('fetch', function(event) {
  if (event.request.url.match(/\.bpg$/i)) {
    event.respondWith( fetchBpgCacheJpg(event.request) );
  }
});

function fetchBpgCacheJpg(request) {
  var cache;
  console.log('Handling fetch event for', request.url);

  // Open caches
  return caches.open('bpg')

    // Try finding resource in cache
    .then(function(bpgCache) {
      cache = bpgCache;
      return cache.match(request);
    })

    // Return cached, or fetch from network & cache
    .then(function(cached) {
      if (cached) {
        console.log(' Found response in cache:', cached);

        return cached;
      } else {
        console.log(' No response for %s found in cache. About to fetch from network...', request.url);

        // We call .clone() on the request since we might use it in the call to cache.put() later on.
        // Both fetch() and cache.put() "consume" the request, so we need to make a copy.
        // (see https://fetch.spec.whatwg.org/#dom-request-clone)
        return fetch(request.clone()).then(function(response) {
          console.log('  Response for %s from network is: %O', request.url, response);

          if (response.status === 200) {
            return response.clone().arrayBuffer().then(function(responseAB) {
              var transcodedBody, bpgResponse;

              transcodedBody = (new BPGDecoder()).load( new Uint8Array(responseAB) );
              bpgResponse = (new Response(transcodedBody, response));

              cache.put(request, bpgResponse.clone());

              return bpgResponse;
            });
          }

          // Return the original response object, which will be used to fulfill the resource request.
          return response;
        });
      }
    }).catch(function(error) {
      // This catch() will handle exceptions that arise from the match() or fetch() operations.
      // Note that a HTTP error response (e.g. 404) will NOT trigger an exception.
      // It will return a normal response object that has the appropriate error code set.
      console.error('  Read-through caching failed:', error);

      throw error;
    });
}
