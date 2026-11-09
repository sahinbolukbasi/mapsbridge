import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import {
  Animated,
  AppState,
  BackHandler,
  StyleSheet,
  View,
  StatusBar,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { useFonts } from "expo-font";
import * as ExpoLinking from "expo-linking";
import { GUEST_TABS, MEMBER_TABS, type MobileStackScreen, type MobileTab } from "./src/types";
import {
  initialNav,
  navReducer,
  onBack,
  topScreen,
  type TabNavAction,
  type TabNavState,
} from "./src/navigation/tab-stack";
import {
  HAPTICS_KEY,
  LockContext,
  ScreenFocusContext,
  Toaster,
  motion,
  setHapticsEnabled,
  useToast,
  type ToastApi,
} from "./src/ui";
import { parseDeepLink, type DeepLink } from "./src/services/deep-links";
import { SharedRouteView } from "./src/components/SharedRouteView";
import { LockScreen } from "./src/components/LockScreen";
import { lockEnabled, shouldLock } from "./src/services/biometric";
import { configureNotifications, scheduleRouteReminders } from "./src/services/notifications";
import { sweepTiles } from "./src/services/tile-cache";
import { ChatScreen } from "./src/screens/ChatScreen";
import { GuestAssistantView } from "./src/screens/GuestAssistantView";
import { AuthScreen } from "./src/screens/AuthScreen";
import { MapScreen } from "./src/screens/MapScreen";
import { PlanScreen } from "./src/screens/PlanScreen";
import { AIScreen } from "./src/screens/AIScreen";
import { CommunityScreen } from "./src/screens/CommunityScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { ONBOARDING_KEY, OnboardingScreen } from "./src/screens/OnboardingScreen";
import { FirstRouteReminder } from "./src/components/FirstRouteReminder";
import { BottomTabBar } from "./src/components/BottomTabBar";
import { PaywallModal } from "./src/components/PaywallModal";
import { SplashScreen } from "./src/components/SplashScreen";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { ScreenErrorBoundary } from "./src/components/ScreenErrorBoundary";
import { runNativeSelfCheck } from "./src/services/native-selfcheck";
import { authService, UserSession } from "./src/services/api";
import { storage } from "./src/services/storage";
import { tripStore } from "./src/services/tripStore";
import { ownerFromEmail } from "./src/services/trip-owner";
import { initRevenueCat, resetRevenueCat } from "./src/services/revenuecat";
import type { ChatContact } from "./src/services/chatStore";
import { clearDraft } from "./src/guest/guest-draft";

import { setFontsAvailable, tokens } from "./src/theme";
import { FONT_SOURCES } from "./src/theme/fonts";
import { tr } from "./src/i18n/ui";
import { resolveGoogleClientId } from "./src/services/auth-config";
const GOOGLE_CLIENT_ID = resolveGoogleClientId(Platform.OS);

// Session persistence constants
const SESSION_REFRESH_INTERVAL = 25 * 60 * 1000; // 25 min (Cognito access token = 60 min)
const SESSION_MAX_IDLE_DAYS = 30; // Auto logout after 30 days of no use

function buildGoogleAuthUrl(): string | null {
  // Savunma: resolveGoogleClientId asla boş dönmez, yine de client_id boşsa URL kurulmaz
  // (boş client_id ile Google hata sayfası açılır). handleGoogleSignIn bunu Türkçe uyarıya çevirir.
  if (!GOOGLE_CLIENT_ID) return null;
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
/** Toaster bağlamını App'e açar (App, Toaster'ın üstünde çizilir). */
function ToastBridge({ onReady }: { onReady: (api: ToastApi) => void }) {
  const api = useToast();
  useEffect(() => onReady(api), [api, onReady]);
  return null;
}

/** Android geri tuşunda son çare sekmesi (design §12.1: … → Planla → çıkış). */
const BACK_HOME: MobileTab = "plan";

// G1: Planla sekmesi açılınca ÖNCE harita gelsin — plan kökünün üstüne "map" önceden itilir.
// Geri (pop) rota listesine (PlanScreen) iner; rota yönetimi harita üstündeki düğmededir (G2).
function startNav(tab: MobileTab): TabNavState<MobileTab, MobileStackScreen> {
  const base = initialNav<MobileTab, MobileStackScreen>(tab);
  return tab === "plan" ? navReducer(base, { type: "push", screen: "map" }) : base;
}

export function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loadingSession, setLoadingSession] = useState<boolean>(true);
  const [authInitialMode, setAuthInitialMode] = useState<"login" | "register">("login");
  const [focusedStopId, setFocusedStopId] = useState<string | null>(null);
  // Keşfet hero metni → Asistan (misafir senaryosu); Topluluk "Mesaj gönder" → Mesajlar.
  // Keşfet kaldırıldığı için prompt artık set edilmiyor; AIScreen prop'u ileride derin bağlantı için durur.
  const [assistantPrompt] = useState<{ text: string; nonce: number } | undefined>(undefined);
  const [chatOpen, setChatOpen] = useState<{ contact: ChatContact; nonce: number }>();
  const [plansOpen, setPlansOpen] = useState(false);
  // Toast'lar alt menünün üstünde (direction §3: mobil alt menünün üstü).
  const [tabBarHeight, setTabBarHeight] = useState(0);
  // N1: ilk açılış tanıtımı (görüldü bayrağı cihazda); okunana kadar açılış ekranı kalır.
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);
  const [linkNonce, setLinkNonce] = useState(0);
  const [ownerReady, setOwnerReady] = useState(false);
  // K4: derin bağlantı hedefleri, biyometrik kilit, yerel bildirim/karo önbelleği kurulumu.
  const [sharedCode, setSharedCode] = useState<string | null>(null);
  const [openTraveler, setOpenTraveler] = useState<{ username: string; nonce: number }>();
  // null = kilit ayarı henüz okunmadı (açılış ekranı kalır); true ise içerikten önce kilit çizilir.
  const [locked, setLocked] = useState<boolean | null>(null);
  const toastRef = useRef<ToastApi | null>(null);
  const pendingLink = useRef<DeepLink | null>(null);
  const backgroundedAt = useRef<number | null>(null);
  // Açılış öz-denetiminde eksik yerli üye bulunursa pasif (karartmayan) bir uyarı gösterilir.
  const nativeDegraded = useRef(false);
  useEffect(() => {
    // Açılış öz-denetimi: yanlış/taşınmış bir yerli yöntem kullanıcı telefonunda render-time
    // throw olmadan burada yakalanır (dev'de görünür). Asla throw etmez.
    const selfCheck = runNativeSelfCheck();
    if (!selfCheck.ok) nativeDegraded.current = true;
    configureNotifications();
    const t = setTimeout(() => sweepTiles(), 3000);
    storage
      .getItem(HAPTICS_KEY)
      .then((v) => setHapticsEnabled(v !== "false"))
      .catch(() => undefined);
    lockEnabled()
      .then((on) => setLocked(on))
      .catch(() => setLocked(false));
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") backgroundedAt.current = Date.now();
      else if (state === "active") {
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        lockEnabled().then((on) => {
          if (shouldLock(on, since, Date.now())) setLocked(true);
        });
      }
    });
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, []);
  useEffect(() => {
    storage
      .getItem(ONBOARDING_KEY)
      .then((v) => setOnboardingSeen(v === "true"))
      .catch(() => setOnboardingSeen(true));
  }, []);
  // Kapıdan girişte dönülecek sekme (web `next` karşılığı; ör. misafir asistan → Asistan).
  const authReturnTab = useRef<MobileTab | null>(null);
  // Yazı tipleri (karar S13): yüklenemezse sistem yazı tipiyle devam edilir.
  const [fontsLoaded, fontError] = useFonts(FONT_SOURCES);
  const fontsSettled = fontsLoaded || !!fontError;
  if (fontsSettled) setFontsAvailable(fontsLoaded && !fontError);

  // Tek IA (design §5.3, S7/S10): misafir ve üye sekme setleri; sekme başına ekran yığını.
  const signedIn = !!session;
  const tabs = signedIn ? MEMBER_TABS : GUEST_TABS;
  const [nav, setNav] = useState<Nav>(() => startNav("plan"));
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
  const openAuth = (mode: "login" | "register", returnTo?: MobileTab) => {
    authReturnTab.current = returnTo ?? null;
    setAuthInitialMode(mode);
    dispatch({ type: "select", tab: "login" });
  };

  // Derin bağlantı (K4): /k/?code= uygulama içi görüntüleyici, /traveler/?u= Topluluk profili,
  // /maps/?tripId= cihazdaki rota. Açılış/tanıtım bitene kadar bekler.
  useEffect(() => {
    const link = pendingLink.current;
    if (!link || loadingSession || !onboardingSeen) return;
    pendingLink.current = null;
    if (link.kind === "share") setSharedCode(link.code);
    else if (link.kind === "traveler") {
      setOpenTraveler({ username: link.username, nonce: Date.now() });
      dispatch({ type: "select", tab: "community" });
    } else if (link.kind === "trip") {
      const target = tripStore.getAllRoutes().find((r) => r.id === link.tripId);
      if (target) {
        tripStore.switchActiveRoute(target.id);
        openMap();
      } else
        toastRef.current?.show({ tone: "warning", message: tr("native.deeplink.tripMissing") });
    }
  }, [linkNonce, loadingSession, onboardingSeen]);

  // Oturum açılınca/kapanınca sekme seti değişir: hem misafir hem üye Planla (harita) ile başlar (G21).
  // Layout effect: boyamadan önce çalışır, eski sekme setiyle boş bir kare görünmez.
  useLayoutEffect(() => {
    if (loadingSession) return;
    const back = authReturnTab.current;
    authReturnTab.current = null;
    const home: MobileTab = signedIn
      ? back && MEMBER_TABS.includes(back)
        ? back
        : "plan"
      : "plan";
    setNav(startNav(home));
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

  // Cihazdaki gezi kaydının sahibi (design §6.3/§6.4, KVKK): başka hesabın gezileri misafire ya da
  // sonraki hesaba gösterilmez; misafirden girişte yalnızca misafir taslakları hesaba aktarılır.
  // Üye sahibinde tripStore sunucuyla eşitlenir (eski doğrudan syncWithServer çağrılarının yerine).
  const tripOwner = ownerFromEmail(session?.email);
  useEffect(() => {
    if (loadingSession) return;
    setOwnerReady(false);
    tripStore
      .setOwner(tripOwner)
      .catch((err: unknown) => console.warn("Route sync error:", err))
      .finally(() => setOwnerReady(true));
  }, [loadingSession, tripOwner]);

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
            await tripStore.clearForSignOut();
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
            name: cachedEmail ? cachedEmail.split("@")[0] : tr("native.user.fallback"),
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
    const onUrl = (url: string | null) => {
      if (!url) return;
      const link = parseDeepLink(url);
      if (link && link.kind !== "oauth") {
        // Oturum/tanıtım hazır değilse bekletilir (derin bağlantı etkisi uygular).
        pendingLink.current = link;
        setLinkNonce((n) => n + 1);
        return;
      }
      if (url.includes("token") || url.includes("callback") || url.includes("#")) {
        handleGoogleIntercept(url);
      }
    };
    // expo-linking: uygulama şeması (mapsbridge://) ve evrensel/App Links aynı akıştan.
    const urlSub = ExpoLinking.addEventListener("url", ({ url }) => onUrl(url));
    ExpoLinking.getInitialURL().then(onUrl);

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
    // Satın alma kimliği yeni hesaba geçer (çıkışta resetRevenueCat ile bırakıldı).
    initRevenueCat(newSession.email).catch((err: unknown) =>
      console.warn("[RevenueCat] Init failed:", err),
    );
  };

  // Google Sign-In: Open the real Google OAuth flow
  const handleGoogleSignIn = async () => {
    try {
      const authUrl = buildGoogleAuthUrl();
      if (!authUrl) {
        Alert.alert(tr("native.auth.google.title"), tr("native.auth.google.openFailed"));
        return;
      }
      const canOpen = await Linking.canOpenURL(authUrl);
      if (canOpen) {
        await Linking.openURL(authUrl);
      } else {
        Alert.alert(tr("native.auth.google.title"), tr("native.auth.google.openFailed"));
      }
    } catch (e) {
      console.warn("Google sign-in open error:", e);
      Alert.alert(tr("native.auth.google.errorTitle"), tr("native.auth.google.error"));
    }
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
          tr("native.auth.google.errorTitleShort"),
          tokens.error_description || tr("native.auth.google.errorGeneric"),
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
        Alert.alert(tr("native.auth.google.errorTitleShort"), tr("native.auth.google.noEmail"));
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
    // Çıkışta hesabın gezileri ve satın alma kimliği cihazdan bırakılır (design §6.3).
    await tripStore.clearForSignOut();
    await clearDraft(storage);
    await resetRevenueCat();
    setSession(null);
  };

  // Açılış ekranı yalnızca gerçek yükleme sürerken (yazı tipleri + oturum; F38, J6).
  if (loadingSession || !fontsSettled || onboardingSeen === null || locked === null) {
    return (
      <View style={styles.appShell}>
        <StatusBar barStyle="dark-content" backgroundColor={tokens.color.bg} />
        <SplashScreen />
      </View>
    );
  }

  if (!onboardingSeen)
    return (
      <ScreenErrorBoundary name="onboarding">
        <OnboardingScreen onDone={() => setOnboardingSeen(true)} />
      </ScreenErrorBoundary>
    );

  const selectTab = (tab: MobileTab) => dispatch({ type: "select", tab });

  const renderTab = (tab: MobileTab): React.ReactNode => {
    switch (tab) {
      case "plan":
        return (
          <PlanScreen
            onOpenMap={openMap}
            guest={!signedIn}
            onRequireAuth={(mode) => openAuth(mode, "plan")}
          />
        );
      case "ai":
        // Misafir hiçbir zaman LLM'e ulaşmaz (design §6): istemci senaryosu, ağ çağrısı yok.
        return signedIn ? (
          <AIScreen
            owner={tripOwner}
            onOpenMap={() => openMap()}
            onOpenPlans={() => setPlansOpen(true)}
          />
        ) : (
          <GuestAssistantView
            prompt={assistantPrompt}
            onRegister={() => openAuth("register", "ai")}
            onLogin={() => openAuth("login", "ai")}
            onOpenPlanner={() => selectTab("plan")}
          />
        );
      case "community":
        return (
          <CommunityScreen
            onOpenMap={() => openMap()}
            guest={!signedIn}
            onRequireAuth={(mode) => openAuth(mode, "community")}
            openTraveler={openTraveler}
            onOpenChat={(contact) => {
              setChatOpen({ contact, nonce: Date.now() });
              selectTab("messages");
            }}
          />
        );
      case "messages":
        return <ChatScreen onOpenMap={() => openMap()} openContact={chatOpen} />;
      case "profile":
        return (
          <ProfileScreen
            onSignOut={handleSignOut}
            onOpenPlan={() => selectTab("plan")}
            onOpenCommunity={() => selectTab("community")}
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
            onOpenAi={() => selectTab("ai")}
            guest={!signedIn}
            onRequireAuth={(mode) => openAuth(mode, "plan")}
          />
        );
    }
  };

  const translateY = tabEnter.interpolate({
    inputRange: [0, 1],
    outputRange: [tokens.motion.distance.sm, 0],
  });

  return (
    <LockContext.Provider value={locked}>
      <Toaster bottomOffset={tabBarHeight}>
        <View style={styles.appShell}>
          <StatusBar barStyle="light-content" backgroundColor={tokens.color.surfaceInverseStrong} />

          {/* Sekme ekranları unmount edilmez (display none); yığındaki ekran kökün yerine çizilir. */}
          <View
            style={styles.screenContainer}
            key={signedIn ? "member" : "guest"}
            accessibilityElementsHidden={locked}
            importantForAccessibility={locked ? "no-hide-descendants" : "auto"}
          >
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
                        {/* Ekran-düzeyi hata sınırı: bir sekmedeki throw yalnız o sekmeyi
                            etkiler; alt menü ve diğer sekmeler ayakta kalır (kök sınır son çare). */}
                        <ScreenErrorBoundary name={tab}>{renderTab(tab)}</ScreenErrorBoundary>
                      </View>
                    </ScreenFocusContext.Provider>
                    {top ? (
                      <ScreenFocusContext.Provider value={active}>
                        <View style={styles.tabScreen}>
                          <ScreenErrorBoundary name={top}>
                            {renderStackScreen(top)}
                          </ScreenErrorBoundary>
                        </View>
                      </ScreenFocusContext.Provider>
                    ) : null}
                  </Animated.View>
                );
              })}
          </View>

          {/* Alt menü her zaman mount; native throw'u (ör. react-native-svg) kök sınıra
              tırmanmasın diye ayrı sınır — çökerse menü boş kalır, uygulama ayakta. */}
          <ScreenErrorBoundary name="tabbar">
            <View onLayout={(e) => setTabBarHeight(e.nativeEvent.layout.height)}>
              <BottomTabBar tabs={tabs} activeTab={nav.tab} onSelectTab={selectTab} />
            </View>
          </ScreenErrorBoundary>

          {/* Kabuk bileşenleri (her zaman mount, per-screen sınır DIŞI): tekil hata sınırlarıyla
              yerelleştirilir; birindeki native throw (react-native-purchases/webview/svg) kök
              "Bir şeyler ters gitti" ekranını tetiklemesin (mobile-crash2). */}
          {/* Planlar (design §7.2 madde 8): misafirde bilgi + kayıt, üyede RevenueCat satın alma. */}
          <ScreenErrorBoundary name="paywall">
            <PaywallModal
              visible={plansOpen}
              guest={!signedIn}
              placement="assistant"
              onClose={() => setPlansOpen(false)}
              onRequireAuth={(mode) => openAuth(mode)}
            />
          </ScreenErrorBoundary>
          <ScreenErrorBoundary name="reminder">
            <FirstRouteReminder
              enabled={signedIn && ownerReady}
              onGranted={() => void scheduleRouteReminders(tripStore.getActiveRoute())}
            />
          </ScreenErrorBoundary>
          <ScreenErrorBoundary name="shared">
            <SharedRouteView code={sharedCode} onClose={() => setSharedCode(null)} />
          </ScreenErrorBoundary>
          <ToastBridge
            onReady={(api) => {
              toastRef.current = api;
              // Öz-denetim bir yerli üyeyi eksik bulduysa karartmadan pasif bilgilendir
              // (mobile-crash2 adım 4): throw yok, render bloklanmaz — yalnız görünür bozulma.
              if (nativeDegraded.current) {
                nativeDegraded.current = false;
                api.show({ tone: "warning", message: tr("native.selfcheck.degraded") });
              }
            }}
          />
          {locked ? (
            <ScreenErrorBoundary name="lock">
              <LockScreen onUnlocked={() => setLocked(false)} />
            </ScreenErrorBoundary>
          ) : null}
        </View>
      </Toaster>
    </LockContext.Provider>
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
});
