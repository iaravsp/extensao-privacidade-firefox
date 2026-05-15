console.log("background.js script ativo-----------------------------------------------");

let thirdPartyConnections = {};

function getDomain(urlString) {
    try {
        return new URL(urlString).hostname;
    } catch (e) {
        return null;
    }
}

browser.webRequest.onBeforeRequest.addListener(
    function(details) {
        if (details.tabId === -1) return;

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
    console.log(`Memória limpa para a aba ${tabId}.`);
});