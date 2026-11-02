import React, { useState, useEffect } from "react";
import { StyleSheet, View, StatusBar, Alert, Linking } from "react-native";
import { MobileTab } from "./src/types";
import { WelcomeScreen } from "./src/screens/WelcomeScreen";
import { AuthScreen } from "./src/screens/AuthScreen";
import { MapScreen } from "./src/screens/MapScreen";
import { PlanScreen } from "./src/screens/PlanScreen";
import { AIScreen } from "./src/screens/AIScreen";
import { CommunityScreen } from "./src/screens/CommunityScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { BottomTabBar } from "./src/components/BottomTabBar";
import { SplashScreen } from "./src/components/SplashScreen";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { authService, UserSession } from "./src/services/api";
import { storage } from "./src/services/storage";
import { tripStore } from "./src/services/tripStore";
import { initRevenueCat } from "./src/services/revenuecat";

import { tokens } from "./src/theme";
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";

// Session persistence constants
const SESSION_REFRESH_INTERVAL = 25 * 60 * 1000; // 25 min (Cognito access token = 60 min)
const SESSION_MAX_IDLE_DAYS = 30; // Auto logout after 30 days of no use

function buildGoogleAuthUrl(): string {
  const nonce = `mb_${Date.now()}`;
  const redirectUri = encodeURIComponent("https://mapsbridge.com/auth/callback");
  const scope = encodeURIComponent("openid email profile");
  // Use prompt=none for silent auth, consent for first time
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=token%20id_token&scope=${scope}&nonce=${nonce}&prompt=select_account`;
}

function parseOAuthTokens(url: string): Record<string, string> {
  let queryString = "";
  const hashIndex = url.indexOf("#");
  const searchIndex = url.indexOf("?");
  if (hashIndex !== -1) {
    queryString = url.substring(hashIndex + 1);
  } else if (searchIndex !== -1) {
    queryString = url.substring(searchIndex + 1);
  }
  const params: Record<string, string> = {};
  if (queryString) {
    queryString.split("&").forEach((pair) => {
      const [k, v] = pair.split("=");
      if (k && v) {
        try {
          params[decodeURIComponent(k)] = decodeURIComponent(v);
        } catch {
          params[k] = v;
        }
      }
    });
  }
  return params;
}

function safeDecodeBase64(input: string): string {
  if (typeof globalThis.atob === "function") {
    return globalThis.atob(input);
  }
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let str = "";
  for (
    let bc = 0, bs = 0, buffer: number, idx = 0;
    (buffer = chars.indexOf(input.charAt(idx++))), ~buffer;
  ) {
    bs = bc % 4 ? bs * 64 + buffer : buffer;
    if (bc++ % 4) {
      str += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
    }
  }
  return str;
}

function decodeJwtPayload(
  jwt: string,
): { email?: string; name?: string; given_name?: string; exp?: number } | null {
  try {
    const parts = jwt.split(".");
    if (parts.length >= 2) {
      let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4 !== 0) {
        b64 += "=";
      }
      const jsonStr = safeDecodeBase64(b64);
      return JSON.parse(jsonStr);
    }
  } catch (e) {
    console.warn("JWT parse error:", e);
  }
  return null;
}

export function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loadingSession, setLoadingSession] = useState<boolean>(true);
  const [showAuthScreen, setShowAuthScreen] = useState<boolean>(false);
  const [authInitialMode, setAuthInitialMode] = useState<"login" | "register">("login");
  const [activeTab, setActiveTab] = useState<MobileTab>("map");
  const [focusedStopId, setFocusedStopId] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState<boolean>(true);

  // Session refresh interval ref
  const sessionRefreshIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Check stored session on launch ──────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      try {
        // Read all session keys in parallel for fast startup
        const keys = await storage.multiGet([
          "mb_token",
          "mb_email",
          "mb_name",
          "mb_refresh_token",
          "mb_last_activity",
        ]);

        const token = keys["mb_token"];
        const email = keys["mb_email"];
        const name = keys["mb_name"];
        const refreshToken = keys["mb_refresh_token"];
        const lastActivity = keys["mb_last_activity"];

        // Check idle timeout (30 days)
        if (lastActivity) {
          const idleMs = Date.now() - parseInt(lastActivity, 10);
          const idleDays = idleMs / (1000 * 60 * 60 * 24);
          if (idleDays > SESSION_MAX_IDLE_DAYS) {
            await authService.signOut();
            setSession(null);
            setLoadingSession(false);
            return;
          }
        }

        // Never kick the user out on app reopen if they have an active session
        if (email || token || refreshToken) {
          const effectiveToken = token || refreshToken || `mb_user_${Date.now()}`;
          const effectiveEmail = email || "user@mapsbridge.com";
          const effectiveName = name || effectiveEmail.split("@")[0];

          // Set session immediately so user opens straight to app without login prompt
          setSession({ token: effectiveToken, email: effectiveEmail, name: effectiveName });
          storage.setItem("mb_last_activity", Date.now().toString()).catch(() => {});
          startSessionRefresh();

          // Initialize RevenueCat with user ID after session is set
          initRevenueCat(effectiveEmail).catch((err: unknown) =>
            console.warn("[RevenueCat] Init failed:", err),
          );

          tripStore
            .syncWithServer()
            .catch((err: unknown) => console.warn("Initial route sync error:", err));

          // Silently refresh token in background if refresh token exists
          if (refreshToken) {
            authService
              .refreshToken()
              .then((refreshed) => {
                if (refreshed) {
                  setSession((prev) => (prev ? { ...prev, token: refreshed } : null));
                }
              })
              .catch((err) => {
                console.warn("[App] Silent background refresh note:", err);
              });
          }
          return;
        }

        setSession(null);
      } catch (err) {
        console.warn("Auth check failed:", err);
        const cachedToken = await storage.getItem("mb_token");
        const cachedEmail = await storage.getItem("mb_email");
        if (cachedToken || cachedEmail) {
          setSession({
            token: cachedToken || `mb_fallback_${Date.now()}`,
            email: cachedEmail || "user@mapsbridge.com",
            name: cachedEmail ? cachedEmail.split("@")[0] : "Kullanıcı",
          });
        } else {
          setSession(null);
        }
      } finally {
        setLoadingSession(false);
      }
    }
    checkAuth();

    // Listen for deep links when OAuth redirects to the app
    const urlSub = Linking.addEventListener("url", ({ url }) => {
      if (url && (url.includes("token") || url.includes("callback") || url.includes("#"))) {
        handleGoogleIntercept(url);
      }
    });

    Linking.getInitialURL().then((url) => {
      if (url && (url.includes("token") || url.includes("callback") || url.includes("#"))) {
        handleGoogleIntercept(url);
      }
    });

    return () => {
      urlSub.remove();
      if (sessionRefreshIntervalRef.current) {
        clearInterval(sessionRefreshIntervalRef.current);
      }
    };
  }, []);

  // ── Session keepalive — refreshes every 25 min ──────────────────────────
  const startSessionRefresh = () => {
    if (sessionRefreshIntervalRef.current) {
      clearInterval(sessionRefreshIntervalRef.current);
    }
    sessionRefreshIntervalRef.current = setInterval(async () => {
      try {
        await storage.setItem("mb_last_activity", Date.now().toString());
        const newToken = await authService.refreshToken();
        if (newToken) {
          setSession((prev) => (prev ? { ...prev, token: newToken } : null));
        }
      } catch (err) {
        console.warn("Session keepalive failed:", err);
      }
    }, SESSION_REFRESH_INTERVAL);
  };

  const handleAuthSuccess = async (newSession: UserSession & { refreshToken?: string }) => {
    try {
      await storage.setItem("mb_token", newSession.token);
      await storage.setItem("mb_email", newSession.email);
      await storage.setItem("mb_last_activity", Date.now().toString());
      if (newSession.name) await storage.setItem("mb_name", newSession.name);
      if (newSession.refreshToken) {
        await storage.setItem("mb_refresh_token", newSession.refreshToken);
      }
    } catch (e) {
      console.warn("Session save failed:", e);
    }
    setSession(newSession);
    setShowAuthScreen(false);
    setActiveTab("map");
    tripStore.syncWithServer().catch((err: unknown) => console.warn("Route sync error:", err));
  };

  // Google Sign-In: Open the real Google OAuth flow
  const handleGoogleSignIn = async () => {
    try {
      const authUrl = buildGoogleAuthUrl();
      const canOpen = await Linking.canOpenURL(authUrl);
      if (canOpen) {
        await Linking.openURL(authUrl);
      } else {
        Alert.alert(
          "Google ile Giriş",
          "Google giriş sayfası açılamadı. Lütfen e-posta ile giriş yapın.",
        );
      }
    } catch (e) {
      console.warn("Google sign-in open error:", e);
      Alert.alert(
        "Google ile Giriş Hatası",
        "Google ile giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.",
      );
    }
  };

  // Apple Sign-In: Not yet implemented
  const handleAppleSignIn = async () => {
    Alert.alert(
      "Apple ile Giriş",
      "Apple ile giriş yakında kullanıma sunulacaktır. Lütfen e-posta ile giriş yapın.",
    );
  };

  // Intercept Google OAuth redirect with improved error handling
  const handleGoogleIntercept = (url: string): boolean => {
    if (!url) return true;

    // Log URL for debugging (remove in production)
    console.warn("Google Auth URL:", url);

    // Check for OAuth callback or tokens in URL
    const hasCallback =
      url.includes("mapsbridge.com/auth/callback") ||
      url.includes("localhost") ||
      url.includes("id_token=") ||
      url.includes("access_token=") ||
      url.includes("error=");

    if (hasCallback) {
      const tokens = parseOAuthTokens(url);

      // Handle OAuth errors
      if (tokens.error) {
        console.warn("Google OAuth error:", tokens.error, tokens.error_description);
        Alert.alert(
          "Google Giriş Hatası",
          tokens.error_description || "Giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.",
        );
        return false;
      }

      let email = "";
      let name = "";

      // Extract from id_token (JWT)
      if (tokens.id_token) {
        const payload = decodeJwtPayload(tokens.id_token);
        if (payload?.email) {
          email = payload.email;
          name = payload.name || payload.given_name || "";
        }
      }

      // Fallback to access_token if no id_token
      if (!email && tokens.access_token) {
        // Try to get user info from Google API
        fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        })
          .then((res) => res.json())
          .then((userInfo) => {
            if (userInfo.email) {
              const googleSession: UserSession = {
                token: tokens.access_token,
                email: userInfo.email,
                name: userInfo.name || userInfo.email.split("@")[0],
              };
              handleAuthSuccess(googleSession);
            }
          })
          .catch((err) => {
            console.warn("Failed to fetch user info:", err);
          });
        return false;
      }

      if (!email) {
        Alert.alert(
          "Google Giriş Hatası",
          "Google hesabından e-posta adresi alınamadı. Lütfen tekrar deneyin.",
        );
        return false;
      }

      const googleSession: UserSession = {
        token: tokens.id_token || tokens.access_token || "",
        email,
        name: name || email.split("@")[0],
      };

      handleAuthSuccess(googleSession);
      return false; // Stop loading the callback redirect page
    }

    // Allow all other URLs to load
    return true;
  };

  const handleSignOut = async () => {
    // Clear session refresh interval
    if (sessionRefreshIntervalRef.current) {
      clearInterval(sessionRefreshIntervalRef.current);
      sessionRefreshIntervalRef.current = null;
    }
    await authService.signOut();
    setSession(null);
    setShowAuthScreen(false);
    setActiveTab("map");
  };

  // Wait until both session loading AND minimum splash animation have settled
  if (loadingSession || showSplash) {
    return (
      <View style={styles.appShell}>
        <StatusBar barStyle="dark-content" backgroundColor={tokens.color.bg} />
        <SplashScreen minDurationMs={1200} onFinish={() => setShowSplash(false)} />
      </View>
    );
  }

  // Not logged in -> Show WelcomeScreen or AuthScreen (No guest exploration bypass)
  if (!session) {
    return (
      <View style={styles.appShell}>
        {showAuthScreen ? (
          <AuthScreen
            initialMode={authInitialMode}
            onSuccess={handleAuthSuccess}
            onCancel={() => setShowAuthScreen(false)}
            onSelectGoogle={handleGoogleSignIn}
            onSelectApple={handleAppleSignIn}
          />
        ) : (
          <WelcomeScreen
            onSelectAuth={(mode) => {
              if (mode === "google") {
                handleGoogleSignIn();
              } else if (mode === "apple") {
                handleAppleSignIn();
              } else if (mode === "register") {
                setAuthInitialMode("register");
                setShowAuthScreen(true);
              } else {
                setAuthInitialMode("login");
                setShowAuthScreen(true);
              }
            }}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.appShell}>
      <StatusBar barStyle="light-content" backgroundColor={tokens.color.surfaceInverseStrong} />

      {/* Screen Routing */}
      <View style={styles.screenContainer}>
        {activeTab === "map" && (
          <MapScreen
            focusedStopId={focusedStopId}
            onClearFocus={() => setFocusedStopId(null)}
            onOpenPlan={() => setActiveTab("plan")}
            onOpenAi={() => setActiveTab("ai")}
          />
        )}
        {activeTab === "plan" && (
          <PlanScreen
            onOpenMap={(stopId) => {
              if (stopId) setFocusedStopId(stopId);
              setActiveTab("map");
            }}
          />
        )}
        {activeTab === "ai" && <AIScreen onOpenMap={() => setActiveTab("map")} />}
        {activeTab === "community" && <CommunityScreen onOpenMap={() => setActiveTab("map")} />}
        {activeTab === "profile" && (
          <ProfileScreen
            onShowWelcome={handleSignOut}
            onOpenMap={() => setActiveTab("map")}
            onOpenPlan={() => setActiveTab("plan")}
          />
        )}
      </View>

      {/* 5 Core Tabs: Harita, Rotalarım, AI Asistan, Topluluk, Profil */}
      <BottomTabBar activeTab={activeTab} onSelectTab={setActiveTab} />
    </View>
  );
}

export function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: tokens.color.surfaceInverseStrong,
  },
  screenContainer: {
    flex: 1,
    overflow: "hidden",
  },
  googleModalHeader: {
    backgroundColor: tokens.color.surfaceInverse,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.brandHover,
  },
  googleNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  googleCloseBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: tokens.color.whiteA08,
  },
  googleCloseText: {
    color: tokens.color.neutral200,
    fontSize: 14,
    fontWeight: "600",
  },
  googleTitleBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  googleLockIcon: {
    fontSize: 12,
  },
  googleHostname: {
    color: tokens.color.accentStrong,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  googleLoadingBox: {
    width: 60,
    alignItems: "flex-end",
  },
  googleWebViewContainer: {
    flex: 1,
    backgroundColor: tokens.color.surface,
  },
});
