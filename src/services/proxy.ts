import browser from "webextension-polyfill";
import { registerDeviceOnInstall } from "./registration";
// import { BASE_URL } from "";
const BASE_URL = import.meta.env.VITE_BASE_URL;

const REGISTER_ENDPOINT = "Server/ServerDetails/{AppId}/{ProtocolIDd}";
let dataReadyResolver: (() => void) | null = null;

export const dataReady = new Promise<void>((resolve) => {
  dataReadyResolver = resolve;
});

let registrationData: any = null;
let apiResponse: any = null;
let mappedCountries: Array<{
  name: string;
  flag: string;
  city?: string;
  ipAddress?: string;
  port?: number;
  id?: number;
}> = [];
let credentials: { username: string; password: string } | null = null;

async function loadRegistrationData() {
  // Check if servers are already in storage
  try {
    const stored = await browser.storage.local.get(["servers"]);
    if (
      stored.servers &&
      Array.isArray(stored.servers) &&
      stored.servers.length > 0
    ) {
      console.log(
        "loadRegistrationData → Servers found in storage, skipping API call"
      );
      mappedCountries = stored.servers;
      if (dataReadyResolver) dataReadyResolver();
      return;
    }
  } catch (error) {
    console.warn("Error checking storage:", error);
  }

  registrationData = await registerDeviceOnInstall(browser);
  console.log("Registration data:", registrationData.response);

  if (
    registrationData?.response?.username &&
    registrationData?.response?.tokenvalidation
  ) {
    credentials = {
      username: registrationData.response.username,
      password: registrationData.response.tokenvalidation,
    };
    console.log("Credentials captured:", credentials);
  }

  if (registrationData?.response?.accessToken) {
    await callGetApi();
  }
  if (dataReadyResolver) dataReadyResolver();
}

async function callGetApi() {
  const accessToken = registrationData?.response?.accessToken;

  if (!accessToken) {
    console.error("Access token not available");
    return;
  }

  try {
    const appId = 1;
    const protocolId = 1;

    const endpoint = REGISTER_ENDPOINT.replace(
      "{AppId}",
      appId.toString()
    ).replace("{ProtocolIDd}", protocolId.toString());

    const url = `${BASE_URL}${endpoint}`;

    console.log("Calling GET API with endpoint:", endpoint);
    console.log("AppId:", appId, "ProtocolID:", protocolId);
    console.log("Using Bearer token:", accessToken);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    apiResponse = await response.json();
    console.log("GET API Response:", apiResponse);

    mappedCountries = mapApiToCountries(apiResponse);
    console.log("Mapped countries:", mappedCountries);

    // Store servers in storage for persistence
    try {
      await browser.storage.local.set({
        servers: mappedCountries.map((server) => ({
          name: server.name,
          flag: server.flag,
          city: server.city,
        })),
      });
      console.log("Servers saved to storage");
    } catch (error) {
      console.error("Error saving servers to storage:", error);
    }
  } catch (error) {
    console.error("Error calling GET API:", error);
  }
}
loadRegistrationData();

function mapApiToCountries(payload: any): Array<{
  name: string;
  flag: string;
  city?: string;
  ipAddress?: string;
  port?: number;
  id?: number;
}> {
  if (!payload) return [];

  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.serverDetails)
    ? payload.serverDetails
    : Array.isArray(payload?.servers)
    ? payload.servers
    : [];

  if (!Array.isArray(list)) return [];

  const first = list[0];
  const finalList =
    first && Array.isArray(first.serverDetails) ? first.serverDetails : list;

  return finalList.map((item: any) => ({
    id: item?.id,
    name: item?.countryName ?? item?.country ?? "Unknown",
    flag: item?.countryFlagLink ?? "",
    city: item?.cityName ?? item?.city ?? "",
    ipAddress: item?.ipAddress,
    port: item?.port,
  }));
}

export function getCountriesFromApi(): Array<{
  name: string;
  flag: string;
  city?: string;
  ipAddress?: string;
  port?: number;
  id?: number;
}> {
  return mappedCountries;
}

export function getApiCredentials(): {
  username: string;
  password: string;
} | null {
  return credentials;
}
