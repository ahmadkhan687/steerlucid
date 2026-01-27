import { useState, useEffect } from "react";
import browser from "webextension-polyfill";
import "./ServerList.css";

interface ApiServer {
  name: string;
  flag: string;
  city?: string;
  ipAddress?: string;
  port?: number;
  id?: number;
}

interface ServerListProps {
  onClose: () => void;
  onSelect: (country: {
    name: string;
    flag: string;
    ipAddress?: string;
    port?: number;
    id?: number;
    city?: string;
  }) => void;
  selectedCountry: {
    name: string;
    flag: string;
    ipAddress?: string;
    port?: number;
    id?: number;
    city?: string;
  } | null;
}

export default function ServerList({
  onClose,
  onSelect,
  selectedCountry,
}: ServerListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [servers, setServers] = useState<ApiServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadServers = async () => {
      try {
        // First try to load from storage (faster, no API call)
        const stored = await browser.storage.local.get(["servers"]);
        if (stored.servers && Array.isArray(stored.servers) && stored.servers.length > 0) {
          console.log("ServerList → Loading servers from storage");
          setServers(stored.servers);
          setLoading(false);
          return;
        }

        // If not in storage, request from background script
        console.log("ServerList → Requesting servers from background script");
        const response = (await browser.runtime.sendMessage({
          action: "getServers",
        })) as { status?: string; servers?: ApiServer[] };

        if (response?.status === "ok" && Array.isArray(response.servers)) {
          console.log("ServerList → Received servers from background, count:", response.servers.length);
          setServers(response.servers);
        } else {
          console.warn("ServerList → Invalid response or no servers");
          setServers([]);
        }
      } catch (error) {
        console.error("ServerList → Error loading servers:", error);
        setServers([]);
      } finally {
        setLoading(false);
      }
    };

    loadServers();
  }, []);

  const filteredCountries = servers.filter((server) => {
    const country = server?.name ?? "";
    const city = server?.city ?? "";
    const q = searchQuery.toLowerCase();
    return country.toLowerCase().includes(q) || city.toLowerCase().includes(q);
  });

  const handleSelect = (server: ApiServer) => {
    const serverData = {
      name: server.name,
      flag: server.flag,
      city: server.city,
    };
    onSelect(serverData);
    // Save using name and city for persistence
    browser.storage.sync.set({
      selectedCountry: {
        name: server.name,
        city: server.city,
        flag: server.flag,
      },
    });
    onClose();
  };

  return (
    <div className="server-list-container">
      <div className="circle1"></div>
      <div className="circle2"></div>
      <div className="circle3"></div>
      <div className="server-list-header">
        <button className="back-button" onClick={onClose}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="server-list-title">Select Server</h2>
        <div style={{ width: "32px" }}></div>
      </div>

      <div className="search-container">
        <svg
          className="search-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Search servers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="server-list-content">
        {filteredCountries.length === 0 ? (
          <div className="no-results">
            <p>No servers found</p>
          </div>
        ) : (
          filteredCountries.map((server) => {
            // Compare by name and city
            const isSelected =
              selectedCountry &&
              selectedCountry.name === server.name &&
              selectedCountry.city === server.city;

            return (
              <button
                key={server.name + server.city}
                className={`server-item ${isSelected ? "selected" : ""}`}
                onClick={() => handleSelect(server)}
              >
                <div className="server-item-left">
                  {server.flag &&
                  typeof server.flag === "string" &&
                  server.flag.length > 0 ? (
                    <img
                      src={server.flag}
                      alt={server.name || "Server"}
                      className="server-flag-image"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="server-flag">🏳️</span>
                  )}
                  <div className="server-info">
                    <span className="server-name">
                      {server.name || "Unknown"}
                    </span>
                    {server.city && (
                      <span className="server-city">{server.city}</span>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <div className="server-check">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
