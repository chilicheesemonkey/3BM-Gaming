async function setupProxy() {
    if (!('serviceWorker' in navigator)) {
        console.error("Service Workers are not supported in this browser.");
        return;
    }

    try {
        // 1. Register the Service Worker
        const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        
        // 2. Ensure the SW is active and ready
        await navigator.serviceWorker.ready;
        
        if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // 3. Initialize BareMux Connection
        if (window.BareMux) {
            const conn = new window.BareMux.BareMuxConnection("./bareworker.js");
            
            let wispUrl = localStorage.getItem("proxServer") || "wss://wisp.mercurywork.shop/";
            if (wispUrl.endsWith('/')) wispUrl = wispUrl.slice(0, -1);
            
            await conn.setTransport(
                "https://cdn.jsdelivr.net/npm/@mercuryworkshop/epoxy-transport@2.1.28/dist/index.mjs", 
                [{ wisp: wispUrl }]
            );

            // 4. Send config safely to the SW
            // If controller is null, fallback to the active registration target
            const targetWorker = navigator.serviceWorker.controller || reg.active;
            
            if (targetWorker) {
                targetWorker.postMessage({
                    type: "config",
                    wispurl: wispUrl,
                    autoswitch: true
                });
            } else {
                console.error("NETLII Proxy: No active Service Worker found to configure.");
            }
            
            console.log("NETLII Proxy: Fully Initialized");
        }
    } catch (err) {
        console.error("Proxy Setup Failed:", err);
    }
}

window.addEventListener('load', setupProxy);
