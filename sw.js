self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

const ADBLOCK = {
    blocked: ["doubleclick.net", "googlesyndication.com", "googleadservices.com", "adnxs.com"] // Simplified for brevity
};

function isAdBlocked(url) {
    return ADBLOCK.blocked.some(pattern => url.includes(pattern));
}

const swPath = self.location.pathname;
const basePath = swPath.substring(0, swPath.lastIndexOf('/') + 1);

self.$scramjet = {
    files: {
        wasm: "https://cdn.jsdelivr.net/gh/Destroyed12121/Staticsj@main/JS/scramjet.wasm.wasm",
        sync: "https://cdn.jsdelivr.net/gh/Destroyed12121/Staticsj@main/JS/scramjet.sync.js",
    }
};

importScripts("https://cdn.jsdelivr.net/gh/Destroyed12121/Staticsj@main/JS/scramjet.all.js");
importScripts("https://cdn.jsdelivr.net/npm/@mercuryworkshop/bare-mux/dist/index.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker({
    prefix: basePath + "scramjet/"
});

let wispConfig = { wispurl: "wss://wisp.mercurywork.shop", autoswitch: true };
let resolveConfigReady;
const configReadyPromise = new Promise(resolve => resolveConfigReady = resolve);

self.addEventListener("message", ({ data }) => {
    if (data.type === "config") {
        if (data.wispurl) wispConfig.wispurl = data.wispurl;
        if (resolveConfigReady) {
            resolveConfigReady();
            resolveConfigReady = null;
        }
    }
});

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // CRITICAL FIX: Bypass proxy for internal scripts to prevent deadlocks
    if (
        url.pathname.includes('sw.js') || 
        url.pathname.includes('bareworker.js') || 
        url.hostname.includes('cdn.jsdelivr.net') ||
        url.pathname.includes('epoxy-transport')
    ) {
        return; 
    }

    event.respondWith((async () => {
        if (isAdBlocked(event.request.url)) return new Response(null, { status: 204 });

        try {
            await scramjet.loadConfig();
            if (scramjet.route(event)) {
                return await scramjet.fetch(event);
            }
        } catch (err) {
            console.error("Scramjet Route Error:", err);
        }
        
        return fetch(event.request);
    })());
});

scramjet.addEventListener("request", async (e) => {
    e.response = (async () => {
        // Ensure config is received before attempting to connect
        if (!wispConfig.wispurl) await configReadyPromise;

        if (!scramjet.client) {
            const connection = new BareMux.BareMuxConnection(basePath + "bareworker.js");
            await connection.setTransport("https://cdn.jsdelivr.net/npm/@mercuryworkshop/epoxy-transport@2.1.28/dist/index.mjs", [{ wisp: wispConfig.wispurl }]);
            scramjet.client = connection;
        }

        return await scramjet.client.fetch(e.url, {
            method: e.method,
            body: e.body,
            headers: e.requestHeaders,
            redirect: "manual",
        });
    })();
});
