// ============================================================
// Paylaşılan global tip bildirimleri
// Google Identity Services ve tarayıcı SpeechRecognition API'leri
// için TEK kaynak. Dosya-içi `declare global` blokları kaldırıldı;
// çakışan bildirim hatalarını önler.
//
// Tüm tipler `declare global` içinde tanımlı ki her modülden
// (import gerekmeden) erişilebilsin.
// ============================================================

declare global {
  // ─── Google Identity Services ────────────────────────────
  interface GooglePromptNotification {
    isNotDisplayed(): boolean;
    isSkippedMoment(): boolean;
    getNotDisplayedReason(): string;
    getSkippedReason(): string;
  }

  interface GoogleIdService {
    initialize(config: Record<string, unknown>): void;
    renderButton(container: Element, options: Record<string, unknown>): void;
    prompt(cb?: (n: GooglePromptNotification) => void): void;
  }

  interface GoogleOAuth2Service {
    initTokenClient(config: Record<string, unknown>): {
      requestAccessToken(opts?: Record<string, unknown>): void;
    };
  }

  interface GoogleAccounts {
    id?: GoogleIdService;
    oauth2?: GoogleOAuth2Service;
  }

  // ─── SpeechRecognition (tarayıcı) ────────────────────────
  interface SpeechRecognitionEvent extends Event {
    readonly results: {
      readonly length: number;
      [index: number]: { readonly [index: number]: { readonly transcript: string } };
    };
  }

  interface SpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start(): void;
    stop(): void;
    abort(): void;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: ((event: Event) => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
  }

  interface Window {
    google?: { accounts?: GoogleAccounts };
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }

  var SpeechRecognition: { prototype: SpeechRecognition; new (): SpeechRecognition } | undefined;
}

export {};
