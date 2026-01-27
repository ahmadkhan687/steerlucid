import { useState, useEffect, useRef } from "react";
import browser from "webextension-polyfill";
import "./App.css";
import SignIn from "../components/SignIn";
import ServerList from "../components/ServerList";
import { getCountriesFromApi } from "../services/proxy";

export default function App() {
  const [showSignIn, setShowSignIn] = useState(false);
  const [showServerList, setShowServerList] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<{
    name: string;
    flag: string;
    ipAddress?: string;
    port?: number;
    id?: number;
    city?: string;
  } | null>(null);
  const [timer, setTimer] = useState(0);
  const [isCheckingProxy, setIsCheckingProxy] = useState(false);
  const intervalRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    if (isCheckingProxy) {
      return;
    }

    const fetchTimer = async () => {
      if (!isMounted) return;

      try {
        const res = (await browser.runtime.sendMessage({
          action: "getTimer",
        })) as { status?: string; timer?: number; isConnected?: boolean };

        if (!isMounted) return;

        const backendConnected = res?.isConnected === true;

        if (typeof res.isConnected === "boolean") {
          setIsConnected(backendConnected);
        }

        if (backendConnected) {
          if (typeof res.timer === "number") {
            setTimer(res.timer);
          }
        } else {
          setTimer(0);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = undefined;
          }
        }
      } catch (err) {
        console.error("Failed to fetch timer:", err);

        if (isMounted && !isCheckingProxy) {
          setIsConnected(false);
          setTimer(0);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = undefined;
          }
        }
      }
    };

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }

    if (isConnected) {
      fetchTimer();
      intervalRef.current = window.setInterval(fetchTimer, 1000);
    } else {
      fetchTimer();
    }

    return () => {
      isMounted = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [isConnected, isCheckingProxy]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
      2,
      "0"
    )}:${String(secs).padStart(2, "0")}`;
  };

  useEffect(() => {
    const loadConnectionState = async () => {
      try {
        const backendState = (await browser.runtime.sendMessage({
          action: "getTimer",
        })) as { status?: string; timer?: number; isConnected?: boolean };

        if (typeof backendState.isConnected === "boolean") {
          setIsConnected(backendState.isConnected);
          if (typeof backendState.timer === "number") {
            setTimer(backendState.timer);
          }
        }

        const result = await browser.storage.sync.get(["selectedCountry"]);

        if (
          result.selectedCountry &&
          typeof result.selectedCountry === "object" &&
          "name" in result.selectedCountry &&
          "city" in result.selectedCountry
        ) {
          const storedCountry = result.selectedCountry as {
            name: string;
            city: string;
            flag?: string;
          };

          const servers = getCountriesFromApi();
          const matchedServer = servers.find(
            (s) =>
              s.name === storedCountry.name && s.city === storedCountry.city
          );

          if (matchedServer) {
            setSelectedCountry({
              name: matchedServer.name,
              flag: matchedServer.flag,
              city: matchedServer.city,
              ipAddress: matchedServer.ipAddress,
              port: matchedServer.port,
              id: matchedServer.id,
            });
          } else {
            setSelectedCountry({
              name: storedCountry.name,
              flag: storedCountry.flag || "",
              city: storedCountry.city,
            });
          }
        }
      } catch (error) {
        console.error("Error loading connection state:", error);

        setIsConnected(false);
        setTimer(0);
      }
    };
    loadConnectionState();
  }, []);

  const handleConnectClick = async () => {
    if (isCheckingProxy) {
      return;
    }

    try {
      if (!isConnected) {
        if (!selectedCountry) {
          return;
        }

        setIsCheckingProxy(true);

        try {
          const connectPromise = browser.runtime.sendMessage({
            action: "connect",
            serverName: selectedCountry.name,
            serverCity: selectedCountry.city,
            serverId: selectedCountry.id,
          });

          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Connection timeout")), 15000);
          });

          let response: { status?: string; error?: string; ip?: string };
          try {
            response = (await Promise.race([
              connectPromise,
              timeoutPromise,
            ])) as { status?: string; error?: string; ip?: string };
          } catch (timeoutError) {
            console.log("Connection response timeout, checking status...");
            const statusCheck = (await browser.runtime.sendMessage({
              action: "getTimer",
            })) as { status?: string; timer?: number; isConnected?: boolean };

            setIsCheckingProxy(false);
            if (statusCheck?.isConnected === true) {
              setIsConnected(true);
              await browser.storage.sync.set({ enabled: true });
              return;
            } else {
              setIsConnected(false);
              setTimer(0);
              await browser.storage.sync.set({ enabled: false });
              return;
            }
          }

          if (response?.status === "connected") {
            setIsCheckingProxy(false);
            setIsConnected(true);
            await browser.storage.sync.set({ enabled: true });
          } else if (response?.status === "error") {
            setIsCheckingProxy(false);
            console.error("Connection error:", response.error);
            setIsConnected(false);
            setTimer(0);
            await browser.storage.sync.set({ enabled: false });
          } else {
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const statusCheck = (await browser.runtime.sendMessage({
              action: "getTimer",
            })) as { status?: string; timer?: number; isConnected?: boolean };

            // Now stop checking and update state
            setIsCheckingProxy(false);

            if (statusCheck?.isConnected === true) {
              setIsConnected(true);
              await browser.storage.sync.set({ enabled: true });
            } else {
              setIsConnected(false);
              setTimer(0);
              await browser.storage.sync.set({ enabled: false });
            }
          }
        } catch (connectError) {
          console.error("Error during connection:", connectError);

          setIsCheckingProxy(false);

          if (
            connectError instanceof Error &&
            connectError.message === "Connection timeout"
          ) {
            try {
              const statusCheck = (await browser.runtime.sendMessage({
                action: "getTimer",
              })) as { status?: string; timer?: number; isConnected?: boolean };

              if (statusCheck?.isConnected === true) {
                setIsConnected(true);
                await browser.storage.sync.set({ enabled: true });
                return;
              }
            } catch (fallbackError) {
              console.error("Error in fallback check:", fallbackError);
            }
          }

          setIsConnected(false);
          setTimer(0);
          await browser.storage.sync.set({ enabled: false });
        }
      } else {
        const response = (await browser.runtime.sendMessage({
          action: "disconnect",
        })) as { status?: string; error?: string };

        if (response && response.status === "disconnected") {
          setIsConnected(false);
          setTimer(0);
          await browser.storage.sync.set({ enabled: false });
        } else if (response && response.status === "error") {
          console.error("Disconnection error:", response.error);
        }
      }
    } catch (error) {
      // Ensure checking state is always reset on error
      setIsCheckingProxy(false);
      console.error("Error toggling connection:", error);
      setIsConnected(false);
      setTimer(0);
      await browser.storage.sync.set({ enabled: false });
    }
  };

  if (showSignIn) {
    return <SignIn onClose={() => setShowSignIn(false)} />;
  }

  if (showServerList) {
    const handleServerSelect = async (country: {
      name: string;
      flag: string;
      ipAddress?: string;
      port?: number;
      id?: number;
      city?: string;
    }) => {
      if (isConnected) {
        try {
          const response = (await browser.runtime.sendMessage({
            action: "disconnect",
          })) as { status?: string; error?: string };
          if (response && response.status === "disconnected") {
            setIsConnected(false);
            setTimer(0);
            await browser.storage.sync.set({ enabled: false });
          }
        } catch (err) {
          console.error("Error disconnecting before switching server:", err);
        }
      }

      setSelectedCountry(country);

      await browser.storage.sync.set({
        selectedCountry: {
          name: country.name,
          city: country.city,
          flag: country.flag,
        },
      });
      setShowServerList(false);
    };

    return (
      <ServerList
        onClose={() => setShowServerList(false)}
        onSelect={handleServerSelect}
        selectedCountry={selectedCountry}
      />
    );
  }

  return (
    <>
      <div className="container">
        <div className="circle1"></div>
        <div className="circle2"></div>
        <div className="circle3"></div>

        <div className="card-wrapper">
          <div className="logo-header">
            <div className="logo-left">
              <div className="logo-shield">
                <svg
                  className="shield-icon"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
                </svg>
              </div>
              <div className="logo-text">
                <span className="steer">Steer</span>
                <span className="lucid">Lucid</span>
              </div>
            </div>
            <button
              className="signin-button"
              onClick={() => setShowSignIn(true)}
            >
              Sign In
            </button>
          </div>

          <div className="main-card">
            <div className="status-header">
              <h1 className="status-title">
                {isCheckingProxy
                  ? "Connecting"
                  : isConnected
                  ? "Connected"
                  : "Disconnected"}
              </h1>
              {isCheckingProxy ? (
                <div className="status-indicator">
                  <div className="pulse-dot connecting"></div>
                  <span>Checking proxy...</span>
                </div>
              ) : isConnected ? (
                <div className="status-indicator">
                  <div className="pulse-dot"></div>
                  <span>Secure Connection</span>
                </div>
              ) : null}
            </div>

            <div className="country-selector">
              <button
                className="country-button"
                onClick={() => setShowServerList(true)}
              >
                <div className="country-info">
                  {selectedCountry && selectedCountry.flag ? (
                    selectedCountry.flag.startsWith("http") ? (
                      <img
                        src={selectedCountry.flag}
                        alt={selectedCountry.name}
                        className="country-flag-image"
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          marginRight: "8px",
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="country-flag">
                        {selectedCountry.flag}
                      </span>
                    )
                  ) : null}
                  <span className="country-name">
                    {selectedCountry?.name || "Select Server"}
                  </span>
                </div>
                <svg
                  className="chevron"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            </div>

            <div className="timer">
              <div className="timer-display">{formatTime(timer)}</div>
            </div>

            <div className="connect-button-wrapper">
              <button
                className={`connect-button ${
                  isCheckingProxy
                    ? "connecting"
                    : isConnected
                    ? "connected"
                    : "disconnected"
                } ${isCheckingProxy ? "loading" : ""}`}
                onClick={handleConnectClick}
                disabled={isCheckingProxy}
              >
                <div
                  className={`button-glow ${
                    isCheckingProxy
                      ? "connecting"
                      : isConnected
                      ? "connected"
                      : "disconnected"
                  }`}
                ></div>
                {isCheckingProxy ? (
                  <div className="loading-spinner"></div>
                ) : (
                  <svg
                    className="power-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2v10"></path>
                    <path d="M18.4 6.6a9 9 0 1 1-12.77.04"></path>
                  </svg>
                )}
              </button>
            </div>

            <div className="connect-text">
              {isCheckingProxy
                ? "Connecting..."
                : isConnected
                ? "Tap to disconnect"
                : "Tap to connect"}
            </div>
          </div>

          <div className="info-card">
            <div className="info-content">
              <svg
                className="globe-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
              <span>
                {isCheckingProxy
                  ? "Connecting to proxy server..."
                  : isConnected
                  ? "Your connection is protected"
                  : "Your connection is not protected"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
