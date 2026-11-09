import * as FileSystem from "expo-file-system";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as LocalAuthentication from "expo-local-authentication";
import * as Sharing from "expo-sharing";
import * as ExpoLinking from "expo-linking";
import Purchases from "react-native-purchases";
import { WebView } from "react-native-webview";
import Svg, { Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
// R16: expo-haptics yalnız ui/haptics.ts'ten import edilir; haptik öz-denetimini oradan alırız.
import { hapticsSelfCheck } from "../ui/haptics";

// Çalışma-zamanı modül öz-denetimi (mobil dayanıklılık). Teşhis (mobile-crash-2026-11-09):
// "object is not a function" — JS tiplerinde çağrılabilir görünen ama binary'de bağlı olmayan bir
// yerli fonksiyon. Bu denetim, uygulamanın GERÇEKTEN çağırdığı her Expo yönteminin açılışta
// typeof "function" olduğunu doğrular; biri eksik/taşınmışsa kullanıcı telefonunda render-time
// throw yerine burada yakalanır (dev'de görünür + CI'da birim testi).
//
// Liste, kaynakta fiilen kullanılan yöntemlerle elle hizalıdır (aşağıdaki sarmalayıcılar):
//   expo-file-system  → tile-cache.ts, MapScreen.tsx (Paths/File/Directory sınıfları)
//   expo-haptics      → ui/haptics.ts
//   expo-location     → services/nearby.ts, services/permissions.ts
//   expo-notifications→ services/notifications.ts, services/permissions.ts
//   expo-local-authentication → services/biometric.ts
//   expo-sharing      → screens/MapScreen.tsx
//   expo-linking      → App.tsx
//
// Kabuk bileşenleri de her zaman mount olur (mobile-crash2) ve kök sınırın dışındadır; bu yüzden
// kullandıkları yerli-dışı (RN community) modüller de doğrulanır:
//   react-native-purchases → services/revenuecat.ts (PaywallModal kabuğu)
//   react-native-webview   → components/SharedRouteView.tsx (paylaşım kabuğu)
//   react-native-svg       → ui/Icon.tsx (her ikon; EmptyState/fallback dâhil)
//   @react-native-async-storage/async-storage → services/storage.ts (açılış oturumu)

type MemberKind = "function" | "constructor" | "component";

interface MemberSpec {
  readonly name: string;
  readonly kind: MemberKind;
}

interface ModuleSpec {
  readonly module: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly ns: any;
  readonly members: readonly MemberSpec[];
}

const fn = (name: string): MemberSpec => ({ name, kind: "function" });
const ctor = (name: string): MemberSpec => ({ name, kind: "constructor" });
// React bileşeni (ör. WebView, Svg, Path): işlevsel olarak typeof "function" doğrulanır.
const comp = (name: string): MemberSpec => ({ name, kind: "component" });

// SDK-57 doğru giriş noktası: expo-file-system YENİ API (Paths/File/Directory) ana girişten gelir;
// `expo-file-system/legacy` ayrı bir modüldür. tile-cache.ts yeni API'yi kullanır — bu yüzden
// Paths nesnesi ve File/Directory sınıf kurucularının varlığı burada doğrulanır (klasik kaynak).
const SPECS: readonly ModuleSpec[] = [
  {
    module: "expo-file-system",
    ns: FileSystem,
    members: [ctor("File"), ctor("Directory")],
  },
  // expo-haptics R16 gereği doğrudan import edilmez; hapticsSelfCheck() ile ui/haptics.ts'ten
  // doğrulanır (checkNativeModules içinde birleştirilir). Üyeleri: selectionAsync, notificationAsync,
  // impactAsync.
  {
    module: "expo-location",
    ns: Location,
    members: [
      fn("getLastKnownPositionAsync"),
      fn("getCurrentPositionAsync"),
      fn("getForegroundPermissionsAsync"),
      fn("requestForegroundPermissionsAsync"),
    ],
  },
  {
    module: "expo-notifications",
    ns: Notifications,
    members: [
      fn("setNotificationHandler"),
      fn("scheduleNotificationAsync"),
      fn("cancelScheduledNotificationAsync"),
      fn("getPermissionsAsync"),
      fn("requestPermissionsAsync"),
    ],
  },
  {
    module: "expo-local-authentication",
    ns: LocalAuthentication,
    members: [fn("hasHardwareAsync"), fn("isEnrolledAsync"), fn("authenticateAsync")],
  },
  {
    module: "expo-sharing",
    ns: Sharing,
    members: [fn("isAvailableAsync"), fn("shareAsync")],
  },
  {
    module: "expo-linking",
    ns: ExpoLinking,
    members: [fn("addEventListener"), fn("getInitialURL")],
  },
  // react-native-purchases: default export `Purchases` nesnesi. revenuecat.ts'te fiilen çağrılan
  // yöntemler. Binary'de pod bağlı değilse bunlar undefined olur → "object is not a function".
  {
    module: "react-native-purchases",
    ns: Purchases,
    members: [
      fn("configure"),
      fn("isConfigured"),
      fn("logIn"),
      fn("logOut"),
      fn("getOfferings"),
      fn("getCustomerInfo"),
      fn("purchasePackage"),
      fn("restorePurchases"),
      fn("setAttributes"),
      fn("setLogLevel"),
    ],
  },
  // react-native-webview: named export `WebView` (React bileşeni). SharedRouteView kabuğu kullanır.
  {
    module: "react-native-webview",
    ns: { WebView },
    members: [comp("WebView")],
  },
  // react-native-svg: her ikonun temeli (ui/Icon.tsx). Svg default + Path named export.
  {
    module: "react-native-svg",
    ns: { Svg, Path },
    members: [comp("Svg"), comp("Path")],
  },
  // async-storage: default export nesnesi (services/storage.ts → açılış oturumu okuması).
  {
    module: "@react-native-async-storage/async-storage",
    ns: AsyncStorage,
    members: [
      fn("getItem"),
      fn("setItem"),
      fn("removeItem"),
      fn("multiGet"),
      fn("clear"),
    ],
  },
];

export interface SelfCheckResult {
  ok: boolean;
  /** "modül.yöntem" biçiminde eksik/yanlış tipli üyeler. */
  missing: string[];
}

/**
 * Bir üyenin kullanılabilir olup olmadığını döndürür. Fonksiyon/kurucu typeof "function"dır.
 * React bileşeni ("component") ise işlevsel bileşen gibi bir fonksiyon OLABİLİR, ya da
 * forwardRef/memo gibi `$$typeof` taşıyan bir nesne olabilir (react-native-webview WebView ve
 * react-native-svg çoğu sürümde forwardRef döndürür). İkisi de geçerli bir render tipidir.
 */
function isRenderableOrCallable(value: unknown, kind: MemberKind): boolean {
  if (typeof value === "function") return true;
  if (kind === "component" && typeof value === "object" && value !== null) {
    // forwardRef/memo bileşenleri: React element tipi olarak $$typeof taşır.
    return "$$typeof" in (value as Record<string, unknown>);
  }
  return false;
}

/**
 * Her Expo modülünün kullanılan yöntemlerinin callable olduğunu doğrular. Modül import'u başarısız
 * olursa (ns tanımsız) tüm üyeleri eksik sayılır. Asla throw etmez; sonucu döndürür.
 * Varsayılan (SPECS) çağrıda haptik öz-denetimi (R16 gereği ui/haptics.ts'ten) de eklenir.
 */
export function checkNativeModules(specs: readonly ModuleSpec[] = SPECS): SelfCheckResult {
  const missing: string[] = [];
  for (const spec of specs) {
    const ns = spec.ns;
    for (const member of spec.members) {
      const value = ns == null ? undefined : ns[member.name];
      if (!isRenderableOrCallable(value, member.kind)) {
        missing.push(`${spec.module}.${member.name}`);
      }
    }
  }
  // Haptik yalnız varsayılan denetimde (gerçek açılış); özel spec testlerinde eklenmez.
  if (specs === SPECS) {
    for (const m of hapticsSelfCheck()) missing.push(m);
  }
  return { ok: missing.length === 0, missing };
}

/** Öz-denetimde kapsanan tüm "modül.yöntem" üyeleri (haptik dâhil; testlerin kapsam kontrolü için). */
export const NATIVE_MODULE_MEMBERS: readonly string[] = [
  ...SPECS.flatMap((s) => s.members.map((m) => `${s.module}.${m.name}`)),
  "expo-haptics.selectionAsync",
  "expo-haptics.notificationAsync",
  "expo-haptics.impactAsync",
];

/**
 * Açılışta çağrılır (App mount). Dev'de eksik üyeleri görünür kılar; prod'da sessizce loglar.
 * Asla throw etmez — bu denetimin kendisi uygulamayı düşürmemeli.
 */
export function runNativeSelfCheck(): SelfCheckResult {
  let result: SelfCheckResult;
  try {
    result = checkNativeModules();
  } catch {
    // Beklenmeyen bir hata denetimi engellememeli.
    return { ok: true, missing: [] };
  }
  if (!result.ok) {
    const detail = result.missing.join(", ");
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.error(
        `[native-selfcheck] Eksik ya da yanlış tipli yerli yöntemler: ${detail}. ` +
          "Yanlış import ya da taşınmış API olabilir; derlemeyi güncel kaynaktan yeniden alın.",
      );
    } else {
      console.warn(`[native-selfcheck] missing native members: ${detail}`);
    }
  }
  return result;
}

// Testlerin spesifikasyonu doğrulayabilmesi için dışa aktarılır.
export const NATIVE_MODULE_SPECS = SPECS;
