// import { BASE_URL } from "./baseurl";
const BASE_URL = import.meta.env.VITE_BASE_URL;

export type RegistrationPayload = {
  deviceId: string;
  deviceName: string;
  remoteIp: string;
  applicationId: number;
};

export type RegistrationResult = {
  payload: RegistrationPayload;
  response: any;
};

const REGISTER_ENDPOINT = "Device/Verification";

export async function registerDeviceOnInstall(browser: any) {
  const payload = await buildPayload(browser);
  console.log("Registering device with payload:", payload);
  const url = `${BASE_URL}${REGISTER_ENDPOINT}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const responseJson = await response.json();
  console.log("Device registration response:", response);
  const result = { payload, response: responseJson };
  return result;
}

async function buildPayload(browser: any): Promise<RegistrationPayload> {
  const deviceId = await getDeviceId(browser);
  const deviceName = await getDeviceName(browser);
  const remoteIp = await getRemoteIp();

  return {
    deviceId,
    deviceName,
    remoteIp,
    applicationId: 1,
  };
}

async function getDeviceId(_browser: any): Promise<string> {
  return "ASHI13112111";
}

async function getDeviceName(browser: any): Promise<string> {
  let os = "unknown-os";
  let browserName = "unknown-browser";

  try {
    const platform = await browser.runtime.getPlatformInfo();
    os = platform.os;
  } catch {
    // ignore
  }

  if (typeof navigator !== "undefined" && navigator.userAgent) {
    const ua = navigator.userAgent.toLowerCase();
    if (
      ua.includes("chrome") ||
      ua.includes("crios") ||
      ua.includes("chromium")
    ) {
      browserName = "chrome";
    } else if (ua.includes("firefox") || ua.includes("fxios")) {
      browserName = "firefox";
    } else if (ua.includes("safari") && !ua.includes("chrome")) {
      browserName = "safari";
    } else if (ua.includes("opr/") || ua.includes("opera")) {
      browserName = "opera";
    } else if (ua.includes("edg")) {
      browserName = "edge";
    }
  }

  return `${browserName}-${os}`;
}

async function getRemoteIp(): Promise<string> {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    if (!response.ok) {
      throw new Error(`Unexpected status ${response.status}`);
    }
    const data = await response.json();
    return data?.ip ?? "unknown";
  } catch {
    return "unknown";
  }
}
