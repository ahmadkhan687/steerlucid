import { registerDeviceOnInstall } from "../services/registration";
import { getCountriesFromApi, getApiCredentials } from "../services/proxy";

let currentProxyInfo: {
  ip: string;
  port: string;
  credentials?: { username: string; password: string } | null;
} | null = null;

let timerInterval: number | null = null;
let timerSeconds = 0;
let currentServerKey: string | null = null;
let proxyValidationDone = false;

function isFirefox(browser: any): boolean {
  return !!(browser.proxy && browser.proxy.onRequest);
}

function startTimer() {
  stopTimer();
  timerSeconds = 0;
  timerInterval = setInterval(() => {
    timerSeconds += 1;
  }, 1000) as unknown as number;
  console.log("Timer started");
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  timerSeconds = 0;
  console.log("Timer stopped");
}

// async function setBadge(browser: any, connected: boolean) {
//   const actionAPI = browser.action || browser.browserAction;
//   if (!actionAPI) return;

//   await actionAPI.setBadgeText({ text: connected ? "✓" : "-" });
//   await actionAPI.setBadgeBackgroundColor({
//     color: connected ? "#22c55e" : "#ef4444",
//   });
// }

async function setExtensionIcon(browser: any, connected: boolean) {
  const actionAPI = browser.action || browser.browserAction;
  if (!actionAPI) return;

  await actionAPI.setIcon({
    path: connected
      ? {
          16: "public/Icon16.png",
          32: "public/Icon32.png",
          48: "public/Icon48.png",
          128: "public/Icon128.png",
        }
      : {
          16: "public/Image.png",
          32: "public/Image.png",
          48: "public/Image.png",
          128: "public/Image.png",
        },
  });
}

async function getPublicIP(
  browser: any,
  bypassProxy: boolean = false
): Promise<string | null> {
  try {
    let proxyListenerRemoved = false;
    if (isFirefox(browser) && bypassProxy && currentProxyInfo) {
      if (browser.proxy.onRequest.hasListener(handleProxyRequest)) {
        browser.proxy.onRequest.removeListener(handleProxyRequest);
        proxyListenerRemoved = true;
        console.log("Temporarily removed proxy listener for IP check");
      }
    }

    const res = await fetch("https://www.google.com", {
      cache: "no-store",
    });
    const data = await res.json();
    console.log("Public IP:", data.ip);

    if (proxyListenerRemoved && currentProxyInfo) {
      browser.proxy.onRequest.addListener(handleProxyRequest, {
        urls: ["<all_urls>"],
      });
      console.log("Restored proxy listener after IP check");
    }

    return data.ip;
  } catch (error) {
    console.warn("Failed to fetch public IP", error);

    if (isFirefox(browser) && bypassProxy && currentProxyInfo) {
      if (!browser.proxy.onRequest.hasListener(handleProxyRequest)) {
        browser.proxy.onRequest.addListener(handleProxyRequest, {
          urls: ["<all_urls>"],
        });
        console.log("Restored proxy listener after IP check error");
      }
    }
    return null;
  }
}

export async function init(browser: any) {
  console.log("Extension init started");

  browser.runtime.onInstalled.addListener(() => {
    browser.storage.sync.set({ enabled: false });
    setExtensionIcon(browser, false);
    // setBadge(browser, false);
    registerDeviceOnInstall(browser).catch(console.error);
  });

  browser.runtime.onMessage.addListener(
    async (
      msg: {
        action: string;
        serverName?: string;
        serverCity?: string;
        serverId?: number;
      },
      _sender: any,
      sendResponse: (arg0: {
        status: string;
        error?: string;
        ip?: string;
        timer?: number;
        isConnected?: boolean;
        servers?: Array<{
          name: string;
          flag: string;
          city?: string;
          ipAddress?: string;
          port?: number;
          id?: number;
        }>;
      }) => void
    ) => {
      console.log("Message received:", msg);

      if (msg.action === "getServers") {
        // First try to get from memory
        let servers = getCountriesFromApi();

        // If not in memory, try to load from storage
        if (servers.length === 0) {
          browser.storage.local
            .get(["servers"])
            .then((result: { servers: string | any[] }) => {
              if (
                result.servers &&
                Array.isArray(result.servers) &&
                result.servers.length > 0
              ) {
                console.log("Common.ts → Loading servers from storage");
                sendResponse({
                  status: "ok",
                  servers: result.servers,
                });
              } else {
                console.log("Common.ts → No servers found in storage");
                sendResponse({
                  status: "ok",
                  servers: [],
                });
              }
            })
            .catch((error: any) => {
              console.error("Error loading servers from storage:", error);
              sendResponse({
                status: "ok",
                servers: [],
              });
            });
          return true; // Keep channel open for async response
        }

        console.log(
          "Common.ts → Returning servers from memory, count:",
          servers.length
        );
        sendResponse({
          status: "ok",
          servers,
        });
        return true;
      }

      if (msg.action === "connect") {
        proxyValidationDone = false;

        const countries = getCountriesFromApi();

        const server = countries.find(
          (s) =>
            (msg.serverId && s.id === msg.serverId) ||
            (msg.serverName &&
              msg.serverCity &&
              s.name === msg.serverName &&
              s.city === msg.serverCity) ||
            (msg.serverName && !msg.serverCity && s.name === msg.serverName)
        );

        if (!server?.ipAddress || !server?.port) {
          sendResponse({ status: "error", error: "Invalid server" });
          return false;
        }

        const credentials = getApiCredentials();
        if (!credentials?.username || !credentials?.password) {
          sendResponse({ status: "error", error: "Missing credentials" });
          return false;
        }

        const ipBefore = await getPublicIP(browser, isFirefox(browser));

        await connectProxy(
          browser,
          server.ipAddress,
          server.port.toString(),
          credentials
        );

        setTimeout(async () => {
          if (proxyValidationDone) return;

          const bypassProxy = isFirefox(browser);
          const ipAfter = await getPublicIP(browser, bypassProxy);

          if (!ipAfter || ipAfter === ipBefore) {
            proxyValidationDone = true;
            console.error("Proxy not working — disconnecting");
            await disconnectProxy(browser);
            setExtensionIcon(browser, false);
            // setBadge(browser, false);
            stopTimer();
            sendResponse({ status: "error", error: "Proxy not working" });
            return;
          }

          proxyValidationDone = true;
          currentServerKey = server.id?.toString() ?? server.name;
          setExtensionIcon(browser, true);
          // setBadge(browser, true);
          startTimer();
          sendResponse({ status: "connected", ip: ipAfter });
        }, 1500);

        return true;
      }

      if (msg.action === "disconnect") {
        await disconnectProxy(browser);
        setExtensionIcon(browser, false);
        // setBadge(browser, false);
        stopTimer();
        currentServerKey = null;
        sendResponse({ status: "disconnected" });
        return true;
      }

      if (msg.action === "getTimer") {
        sendResponse({
          status: "ok",
          timer: timerSeconds,
          isConnected: currentServerKey !== null,
        });
        return false;
      }

      return false;
    }
  );
}

async function connectProxy(
  browser: any,
  ip: string,
  port: string,
  credentials: { username: string; password: string }
) {
  currentProxyInfo = { ip, port, credentials };

  if (isFirefox(browser)) {
    if (browser.proxy.onRequest.hasListener(handleProxyRequest)) {
      browser.proxy.onRequest.removeListener(handleProxyRequest);
    }

    browser.proxy.onRequest.addListener(handleProxyRequest, {
      urls: ["<all_urls>"],
    });
  } else {
    const pac = `function FindProxyForURL(){return "PROXY ${ip}:${port}; DIRECT";}`;
    await browser.proxy.settings.set({
      value: { mode: "pac_script", pacScript: { data: pac } },
      scope: "regular",
    });
  }

  await browser.storage.sync.set({ enabled: true });
}

function handleProxyRequest() {
  if (!currentProxyInfo) return { type: "direct" };
  console.log("Firefox proxy request handled");
  return {
    type: "http",
    host: currentProxyInfo.ip,
    port: parseInt(currentProxyInfo.port),
  };
}

async function disconnectProxy(browser: any) {
  if (isFirefox(browser)) {
    if (browser.proxy.onRequest.hasListener(handleProxyRequest)) {
      browser.proxy.onRequest.removeListener(handleProxyRequest);
    }
  } else {
    await browser.proxy.settings.set({
      value: { mode: "direct" },
      scope: "regular",
    });
  }

  currentProxyInfo = null;
  proxyValidationDone = false;
  await browser.storage.sync.set({ enabled: false });
}
