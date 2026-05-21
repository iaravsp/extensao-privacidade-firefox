console.log("background.js script ativo-----------------------------------------------");

let thirdPartyConnections = {};
let detectedRedirects = {};
let insecureScripts = {};
let injectedCookies = {};

function getDomain(urlString) {
    try {
        return new URL(urlString).hostname;
    } catch (e) {
        return null;
    }
}

browser.webRequest.onBeforeRedirect.addListener(
    function(details) {
        if (details.tabId === -1) return;

        if (!detectedRedirects[details.tabId]) {
            detectedRedirects[details.tabId] = [];
        }

        detectedRedirects[details.tabId].push({
            from: details.url,
            to: details.redirectUrl,
            timestamp: new Date().toISOString()
        });

        console.log(`[Aba ${details.tabId}] Redirecionamento detectado: ${details.url} -> ${details.redirectUrl}`);
    },
    { urls: ["<all_urls>"] }
);

browser.webRequest.onBeforeRequest.addListener(
    function(details) {
        if (details.tabId === -1) return;

        if (details.type === "script" && details.url.startsWith("http://")) {
            if (!insecureScripts[details.tabId]) {
                insecureScripts[details.tabId] = [];
            }
            insecureScripts[details.tabId].push({
                url: details.url,
                timestamp: new Date().toISOString()
            });
            console.warn(`[Aba ${details.tabId}] Alerta: Script inseguro detectado (Potencial Hooking): ${details.url}`);
        }

        browser.tabs.get(details.tabId).then((tab) => {
            if (!tab || !tab.url) return;

            const mainDomain = getDomain(tab.url);
            const requestDomain = getDomain(details.url); 

            if (mainDomain && requestDomain && !requestDomain.endsWith(mainDomain)) {
                
                if (!thirdPartyConnections[details.tabId]) {
                    thirdPartyConnections[details.tabId] = [];
                }
                thirdPartyConnections[details.tabId].push({
                    domain: requestDomain,
                    type: details.type 
                });

                console.log(`[Aba ${details.tabId}] Conexão de Terceira Parte: ${requestDomain} | Tipo: ${details.type}`);
            }
        }).catch(err => {
        });
    },
    { urls: ["<all_urls>"] }
);

browser.tabs.onRemoved.addListener((tabId) => {
    delete thirdPartyConnections[tabId];
    delete injectedCookies[tabId];
    delete detectedRedirects[tabId];
    delete insecureScripts[tabId];
    console.log(`Memória limpa para a aba ${tabId}.`);
});

browser.webRequest.onHeadersReceived.addListener(
    function(details) {
        if (details.tabId === -1) return;

        browser.tabs.get(details.tabId).then((tab) => {
            if (!tab || !tab.url) return;

            const tabDomain = getDomain(tab.url);
            const requestDomain = getDomain(details.url);

            if (!injectedCookies[details.tabId]) {
                injectedCookies[details.tabId] = {
                    cookies: [],
                    supercookies: []
                };
            }

            if (details.responseHeaders) {
                details.responseHeaders.forEach(header => {
                    const headerName = header.name.toLowerCase();

                    if (headerName === "set-cookie") {
                        const isPersistent = /expires=|max-age=/i.test(header.value);
                        const isFirstParty = tabDomain && requestDomain && (requestDomain === tabDomain || requestDomain.endsWith("." + tabDomain) || tabDomain.endsWith("." + requestDomain));
                        
                        const cookieData = {
                            domain: requestDomain,
                            party: isFirstParty ? "Primeira Parte" : "Terceira Parte",
                            type: isPersistent ? "Persistente" : "Sessão",
                            content: header.value.split(';')[0]
                        };

                        injectedCookies[details.tabId].cookies.push(cookieData);
                        console.log(`[Aba ${details.tabId}] Cookie ${cookieData.party} (${cookieData.type}) detectado: ${cookieData.domain}`);
                    }

                    if (headerName === "etag" || headerName === "strict-transport-security") {
                        const supercookieData = {
                            domain: requestDomain,
                            type: header.name,
                            value: header.value
                        };
                        injectedCookies[details.tabId].supercookies.push(supercookieData);
                        console.log(`[Aba ${details.tabId}] Potencial Supercookie detectado (${header.name}) em: ${requestDomain}`);
                    }
                });
            }
        }).catch(err => {});
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"]
);