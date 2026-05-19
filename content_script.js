(function() {
    const fingerprintAlerts = [];

    async function getStorageAudit() {
        const audit = {
            localStorage: {},
            sessionStorage: {},
            indexedDB: []
        };

        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const val = localStorage.getItem(key);
                audit.localStorage[key] = {
                    size: val ? val.length : 0
                };
            }

            //sessionstorage
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                const val = sessionStorage.getItem(key);
                audit.sessionStorage[key] = {
                    size: val ? val.length : 0
                };
            }

            // db
            if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
                const dbs = await window.indexedDB.databases();
                audit.indexedDB = dbs.map(db => ({ 
                    name: db.name, 
                    version: db.version 
                }));
            }
        } catch (e) {
            console.warn("[Privacy Audit] Erro ao auditar armazenamento:", e);
        }

        return audit;
    }

    function injectFingerprintHooks() {
        const scriptCode = `
            (function() {
                const notify = (api, method, params = "") => {
                    const event = new CustomEvent('FingerprintAlert', {
                        detail: { 
                            api, 
                            method, 
                            params, 
                            timestamp: new Date().toISOString(),
                            url: window.location.href
                        }
                    });
                    window.dispatchEvent(event);
                };

                const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
                HTMLCanvasElement.prototype.toDataURL = function() {
                    notify('Canvas', 'toDataURL');
                    return originalToDataURL.apply(this, arguments);
                };

                const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
                CanvasRenderingContext2D.prototype.getImageData = function() {
                    notify('Canvas', 'getImageData');
                    return originalGetImageData.apply(this, arguments);
                };

                const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
                WebGLRenderingContext.prototype.getParameter = function(param) {
                    if (param === 37445 || param === 37446) {
                        const paramName = param === 37445 ? 'UNMASKED_VENDOR_WEBGL' : 'UNMASKED_RENDERER_WEBGL';
                        notify('WebGL', 'getParameter', paramName);
                    }
                    return originalGetParameter.apply(this, arguments);
                };

                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (AudioContextClass) {
                    const originalCreateOscillator = AudioContextClass.prototype.createOscillator;
                    AudioContextClass.prototype.createOscillator = function() {
                        notify('AudioContext', 'createOscillator');
                        return originalCreateOscillator.apply(this, arguments);
                    };

                    const originalCreateDynamicsCompressor = AudioContextClass.prototype.createDynamicsCompressor;
                    AudioContextClass.prototype.createDynamicsCompressor = function() {
                        notify('AudioContext', 'createDynamicsCompressor');
                        return originalCreateDynamicsCompressor.apply(this, arguments);
                    };
                }
                
                console.log("[Privacy Extension] Hooks de detecção injetados com sucesso.");
            })();
        `;

        const script = document.createElement('script');
        script.textContent = scriptCode;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
    }


    window.addEventListener('FingerprintAlert', (event) => {
        console.log("[Privacy Audit] Alerta de Fingerprinting detectado:", event.detail);
        fingerprintAlerts.push(event.detail);
        if (fingerprintAlerts.length > 100) fingerprintAlerts.shift();
    });


    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "getSecurityReport") {
            getStorageAudit().then(storageReport => {
                sendResponse({
                    storage: storageReport,
                    fingerprintAlerts: fingerprintAlerts
                });
            });
            return true; 
        }
    });

    injectFingerprintHooks();
})();
