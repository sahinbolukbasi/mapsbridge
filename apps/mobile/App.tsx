import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Animated, BackHandler, StyleSheet, View, StatusBar, Alert, Linking } from "react-native";
import { useFonts } from "expo-font";
import { GUEST_TABS, MEMBER_TABS, type MobileStackScreen, type MobileTab } from "./src/types";
import {
  initialNav,
  navReducer,
  onBack,
  topScreen,
  type TabNavAction,
  type TabNavState,
} from "./src/navigation/tab-stack";
import { AuthGate, ScreenFocusContext, motion } from "./src/ui";
import { ChatScreen } from "./src/screens/ChatScreen";
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

import { setFontsAvailable, tokens } from "./src/theme";
import { FONT_SOURCES } from "./src/theme/fonts";
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

type Nav = TabNavState<MobileTab, MobileStackScreen>;

/** Android geri tuşunda son çare sekmesi (design §12.1: … → Planla → çıkış). */
const BACK_HOME: MobileTab = "plan";

export function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loadingSession, setLoadingSession] = useState<boolean>(true);
  const [authInitialMode, setAuthInitialMode] = useState<"login" | "register">("login");
  const [focusedStopId, setFocusedStopId] = useState<string | null>(null);
  // Yazı tipleri (karar S13): yüklenemezse sistem yazı tipiyle devam edilir.
  const [fontsLoaded, fontError] = useFonts(FONT_SOURCES);
  const fontsSettled = fontsLoaded || !!fontError;
  if (fontsSettled) setFontsAvailable(fontsLoaded && !fontError);

  // Tek IA (design §5.3, S7/S10): misafir ve üye sekme setleri; sekme başına ekran yığını.
  const signedIn = !!session;
  const tabs = signedIn ? MEMBER_TABS : GUEST_TABS;
  const [nav, setNav] = useState<Nav>(() => initialNav<MobileTab, MobileStackScreen>("explore"));
  const navRef = useRef(nav);
  navRef.current = nav;
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const dispatch = (action: TabNavAction<MobileTab, MobileStackScreen>) =>
    setNav((prev) => navReducer(prev, action));
  const goBack = () => {
    const r = onBack(navRef.current, BACK_HOME, tabsRef.current);
    if (r.handled) setNav(r.state);
    return r.handled;
  };
  const openMap = (stopId?: string) => {
    if (stopId) setFocusedStopId(stopId);
    dispatch({ type: "push", tab: "plan", screen: "map" });
  };
  const openAuth = (mode: "login" | "register") => {
    setAuthInitialMode(mode);
    dispatch({ type: "select", tab: "login" });
  };

  // Oturum açılınca/kapanınca sekme seti değişir: misafir Keşfet'te, üye Planla'da başlar (J6).
  // Layout effect: boyamadan önce çalışır, eski sekme setiyle boş bir kare görünmez.
  useLayoutEffect(() => {
    if (loadingSession) return;
    setNav(initialNav<MobileTab, MobileStackScreen>(signedIn ? "plan" : "explore"));
  }, [loadingSession, signedIn]);

  // Android geri tuşu (design §9, §12.1): yığın → önceki sekme → Planla → sistem (çıkış).
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", goBack);
    return () => sub.remove();
    // goBack yalnızca ref'leri okur.
  }, []);

  // Sekme geçişi (design §8.2): crossfade + 4pt kayma, `base` / `enter` (reduce: anında).
  const tabEnter = useRef(new Animated.Value(1)).current;
  const lastTab = useRef(nav.tab);
  useEffect(() => {
    if (lastTab.current === nav.tab) return;
    lastTab.current = nav.tab;
    tabEnter.setValue(0);
    motion.animate(tabEnter, 1, { useNativeDriver: true, easing: "enter" }).start();
  }, [nav.tab, tabEnter]);

  // Ziyaret edilen sekmeler açık kalır (kaydırma konumu korunur, design §8.3); set değişince sıfırlanır.
  const mountedTabs = useRef({ key: signedIn, tabs: new Set<MobileTab>() });
  if (mountedTabs.current.key !== signedIn)
    mountedTabs.current = { key: signedIn, tabs: new Set() };
  mountedTabs.current.tabs.add(nav.tab);

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
  };

  // Açılış ekranı yalnızca gerçek yükleme sürerken (yazı tipleri + oturum; F38, J6).
  if (loadingSession || !fontsSettled) {
    return (
      <View style={styles.appShell}>
        <StatusBar barStyle="dark-content" backgroundColor={tokens.color.bg} />
        <SplashScreen />
      </View>
    );
  }

  const renderTab = (tab: MobileTab): React.ReactNode => {
    switch (tab) {
      case "explore":
        // FEAT-012 Keşfet ekranını kurana dek misafir ana sayfası bugünkü karşılama içeriğidir.
        return (
          <WelcomeScreen
            onSelectAuth={(mode) => {
              if (mode === "google") handleGoogleSignIn();
              else if (mode === "apple") handleAppleSignIn();
              else openAuth(mode);
            }}
          />
        );
      case "plan":
        return <PlanScreen onOpenMap={openMap} />;
      case "ai":
        // Misafir hiçbir zaman LLM'e ulaşmaz (design §6): misafir senaryosu (FEAT-012) gelene dek
        // asistan sekmesi kimlik kapısıdır; ağ çağrısı yapılmaz.
        return signedIn ? (
          <AIScreen onOpenMap={() => openMap()} />
        ) : (
          <AuthGate
            variant="page"
            reason="ai"
            onRegister={() => openAuth("register")}
            onLogin={() => openAuth("login")}
          />
        );
      case "community":
        return <CommunityScreen onOpenMap={() => openMap()} />;
      case "messages":
        return <ChatScreen onOpenMap={() => openMap()} />;
      case "profile":
        return (
          <ProfileScreen
            onShowWelcome={handleSignOut}
            onOpenMap={() => openMap()}
            onOpenPlan={() => dispatch({ type: "select", tab: "plan" })}
            onOpenMessages={() => dispatch({ type: "select", tab: "messages" })}
          />
        );
      case "login":
        return (
          <AuthScreen
            key={authInitialMode}
            initialMode={authInitialMode}
            onSuccess={handleAuthSuccess}
            onCancel={goBack}
            onSelectGoogle={handleGoogleSignIn}
            onSelectApple={handleAppleSignIn}
          />
        );
    }
  };

  const renderStackScreen = (screen: MobileStackScreen): React.ReactNode => {
    switch (screen) {
      case "map":
        return (
          <MapScreen
            focusedStopId={focusedStopId}
            onClearFocus={() => setFocusedStopId(null)}
            onOpenPlan={() => dispatch({ type: "pop" })}
            onOpenAi={() => dispatch({ type: "select", tab: "ai" })}
          />
        );
    }
  };

  const translateY = tabEnter.interpolate({
    inputRange: [0, 1],
    outputRange: [tokens.motion.distance.sm, 0],
  });

  return (
    <View style={styles.appShell}>
      <StatusBar barStyle="light-content" backgroundColor={tokens.color.surfaceInverseStrong} />

      {/* Sekme ekranları unmount edilmez (display none); yığındaki ekran kökün yerine çizilir. */}
      <View style={styles.screenContainer} key={signedIn ? "member" : "guest"}>
        {tabs
          .filter((tab) => mountedTabs.current.tabs.has(tab))
          .map((tab) => {
            const active = tab === nav.tab;
            const top = topScreen(nav, tab);
            return (
              <Animated.View
                key={tab}
                style={[
                  styles.tabScreen,
                  active ? { opacity: tabEnter, transform: [{ translateY }] } : styles.hidden,
                ]}
                accessibilityElementsHidden={!active}
                importantForAccessibility={active ? "auto" : "no-hide-descendants"}
              >
                <ScreenFocusContext.Provider value={active && !top}>
                  <View style={[styles.tabScreen, top ? styles.hidden : null]}>
                    {renderTab(tab)}
                  </View>
                </ScreenFocusContext.Provider>
                {top ? (
                  <ScreenFocusContext.Provider value={active}>
                    <View style={styles.tabScreen}>{renderStackScreen(top)}</View>
                  </ScreenFocusContext.Provider>
                ) : null}
              </Animated.View>
            );
          })}
      </View>

      <BottomTabBar
        tabs={tabs}
        activeTab={nav.tab}
        onSelectTab={(tab) => dispatch({ type: "select", tab })}
      />
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
  tabScreen: { flex: 1 },
  hidden: { display: "none" },
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
