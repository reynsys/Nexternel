/* Nexternel shortcut helper.
 * Lets phones and computers install Nexternel as a shortcut that opens full screen.
 * It keeps NO copies of pages or data (only the logo icon): everything always comes fresh from
 * the home server, so updates show at once. Only when the home cannot be reached does it show a small
 * "cannot be reached" page with a Try again button instead of the browser's error page. */

const ICON = "/icon-192.png";
const ICON_STORE = "nexternel-icon";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(ICON_STORE).then((store) => store.add(ICON)).catch(() => {}));
});
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const OFFLINE_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nexternel</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         font-family: system-ui, sans-serif; background: #0d1117; color: #e6edf3; padding: 16px; box-sizing: border-box; }
  main { max-width: 360px; text-align: center; }
  img { width: 72px; height: 72px; border-radius: 16px; }
  h1 { font-size: 20px; margin: 16px 0 8px; }
  p { color: #9aa3b2; line-height: 1.5; margin: 0 0 20px; }
  button { font: inherit; padding: 10px 20px; border-radius: 8px; border: 1px solid #1f6feb;
           background: #1f6feb; color: #fff; cursor: pointer; }
</style></head>
<body><main>
  <img src="${ICON}" alt="">
  <h1>Nexternel cannot be reached</h1>
  <p>Check that this device is online. Away from home, Nexternel opens only with Nexternel Anywhere.</p>
  <button onclick="location.reload()">Try again</button>
</main></body></html>`;

self.addEventListener("fetch", (event) => {
  if (new URL(event.request.url).pathname === ICON) {
    event.respondWith(fetch(event.request).catch(() => caches.match(ICON)));
    return;
  }
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_PAGE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});
