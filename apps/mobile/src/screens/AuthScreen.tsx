import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { authService, type UserSession } from "../services/api";
import {
  Button,
  Card,
  GoogleLogo,
  Icon,
  IconButton,
  Notice,
  Screen,
  ScreenHeader,
  SegmentedControl,
  TextField,
  Txt,
} from "../ui";
import { tr } from "../i18n/ui";
import { tokens } from "../theme";

// G19: üçüncü-taraf giriş (Cognito IdP + native kimlik doğrulama) kullanıcı sağlayıcı ayarını
// yapınca bağlanır. O zamana dek bu ekranda yalnızca Google (bugünkü OAuth) + e-posta vardır;
// diğer sağlayıcı düğmeleri HİÇ render edilmez (karar S20/S27, mobile-design-system guard).

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "unknown";

// Kimlik ekranı (design §6.4, §9 "Kimlik (AuthCard)"; kararlar S7, S20): web AuthCard adımlarıyla
// aynı sıra: Giriş / Kayıt → e-posta doğrulama kodu; Şifremi unuttum → kod + yeni şifre. Kapılardan
// ve Giriş sekmesinden açılır. Cognito çağrıları (authService) DEĞİŞMEDİ. Google bugünkü OAuth
// akışıyla; Apple ile giriş henüz entegre değil (yalnız "yakında" uyarısı veriyordu), bu yüzden web
// gibi düğme çizilmez (I10, S20). İşlevsiz "Beni hatırla" kutusu kaldırıldı (S20).
type AuthMode = "login" | "register" | "confirm_signup" | "forgot_password" | "reset_password";

interface AuthScreenProps {
  onSuccess: (session: UserSession) => void;
  onCancel?: () => void;
  onSelectGoogle?: () => void;
  initialMode?: AuthMode;
}

const USERNAME_RE = /^[a-z0-9_.-]{1,40}$/;
const RULES = [
  { key: "edit.pw.rule.length", test: (p: string) => p.length >= 12 },
  { key: "edit.pw.rule.lower", test: (p: string) => /[a-zğüşıöç]/.test(p) },
  { key: "edit.pw.rule.upper", test: (p: string) => /[A-ZĞÜŞİÖÇ]/.test(p) },
  { key: "edit.pw.rule.digit", test: (p: string) => /[0-9]/.test(p) },
  { key: "edit.pw.rule.symbol", test: (p: string) => /[^A-Za-z0-9ğüşıöçĞÜŞİÖÇ]/.test(p) },
] as const;

const TITLES: Record<AuthMode, { title: string; sub: (email: string) => string }> = {
  login: { title: tr("gate.login"), sub: () => tr("native.auth.login.sub") },
  register: { title: tr("gate.register"), sub: () => tr("native.auth.register.sub") },
  confirm_signup: {
    title: tr("native.auth.confirm.title"),
    sub: (email) => tr("native.auth.confirm.sub", { email }),
  },
  forgot_password: {
    title: tr("native.auth.forgot.title"),
    sub: () => tr("native.auth.forgot.sub"),
  },
  reset_password: {
    title: tr("native.auth.reset.title"),
    sub: () => tr("native.auth.reset.sub"),
  },
};

export function AuthScreen({
  onSuccess,
  onCancel,
  onSelectGoogle,
  initialMode = "login",
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // F3/G18: canlı kullanıcı adı uygunluğu — debounce'lu, mevcut public GET /profiles/{username}.
  // Yeni backend ucu YOK. Ağ/5xx = "unknown" (kaydı bloklamaz, yalnız kesin "taken" bloklar).
  useEffect(() => {
    if (mode !== "register") return;
    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser) {
      setUsernameStatus("idle");
      return;
    }
    if (!USERNAME_RE.test(cleanUser)) {
      setUsernameStatus("invalid");
      return;
    }
    setUsernameStatus("checking");
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await authService.checkUsername(cleanUser);
      if (!cancelled) setUsernameStatus(res === "available" ? "available" : res === "taken" ? "taken" : "unknown");
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [username, mode]);

  const usernameMsg: Record<UsernameStatus, string> = {
    idle: "",
    checking: tr("native.auth.username.checking"),
    available: tr("native.auth.username.available"),
    taken: tr("native.auth.username.taken"),
    invalid: tr("native.auth.username.invalid"),
    unknown: "",
  };

  const go = (next: AuthMode) => {
    setError("");
    setMode(next);
  };

  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    setError("");
    setInfo("");
    try {
      await fn();
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : tr("ui.unexpectedError"));
    } finally {
      setLoading(false);
    }
  };

  const signIn = () => {
    if (!email.trim() || !password) {
      setError(tr("native.auth.err.loginFields"));
      return;
    }
    run(async () => {
      try {
        const session = await authService.signIn(email, password);
        // G18: token artık var — kayıt sırasında seçilen kullanıcı adını yayınla (en iyi çaba).
        await authService.flushPendingUsername();
        onSuccess(session);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("UserNotConfirmedException") || msg.includes("not confirmed")) {
          setInfo(tr("native.auth.info.unconfirmed"));
          setMode("confirm_signup");
          return;
        }
        throw err;
      }
    });
  };

  const pwFor = mode === "reset_password" ? newPassword : password;
  const pwValid = RULES.every((r) => r.test(pwFor));

  const signUp = () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUser = username.trim().toLowerCase();
    // F2: Ad Soyad + Kullanıcı adı + E-posta + Şifre (telefon yok).
    if (!fullName.trim() || !cleanUser || !cleanEmail || !password) {
      setError(tr("native.auth.err.registerFields"));
      return;
    }
    if (!USERNAME_RE.test(cleanUser)) {
      setError(tr("native.auth.err.usernameInvalid"));
      return;
    }
    if (usernameStatus === "taken") {
      setError(tr("native.auth.err.usernameTaken"));
      return;
    }
    if (!pwValid) {
      setError(tr("edit.pw.invalid"));
      return;
    }
    run(async () => {
      await authService.signUp(cleanEmail, password, fullName.trim());
      // G18 publish ZAMANLAMASI: kayıt anında token YOK. Kullanıcı adını cihaza yaz;
      // kullanıcı doğrulayıp GİRİNCE signIn içinde flushPendingUsername ile yayınlanır.
      await authService.stashPendingUsername(cleanUser);
      setInfo(tr("native.auth.info.codeSent", { email: cleanEmail }));
      setMode("confirm_signup");
    });
  };

  const confirm = () => {
    if (!code.trim()) {
      setError(tr("native.auth.err.code"));
      return;
    }
    run(async () => {
      await authService.confirmSignUp(email, code);
      setInfo(tr("native.auth.info.confirmed"));
      setMode("login");
    });
  };

  const forgot = () => {
    if (!email.trim()) {
      setError(tr("native.auth.err.forgotEmail"));
      return;
    }
    run(async () => {
      await authService.forgotPassword(email);
      setInfo(tr("native.auth.info.resetSent", { email }));
      setMode("reset_password");
    });
  };

  const reset = () => {
    if (!code.trim() || !newPassword) {
      setError(tr("native.auth.err.resetFields"));
      return;
    }
    if (!pwValid) {
      setError(tr("edit.pw.invalid"));
      return;
    }
    run(async () => {
      await authService.confirmForgotPassword(email, code, newPassword);
      setInfo(tr("native.auth.info.reset"));
      setMode("login");
    });
  };

  const submit = {
    login: signIn,
    register: signUp,
    confirm_signup: confirm,
    forgot_password: forgot,
    reset_password: reset,
  }[mode];
  const submitLabel = {
    login: tr("gate.login"),
    register: tr("native.auth.submit.register"),
    confirm_signup: tr("native.auth.submit.confirm"),
    forgot_password: tr("native.auth.submit.forgot"),
    reset_password: tr("edit.pw.submit"),
  }[mode];

  const head = TITLES[mode];
  const showPwRules = (mode === "register" || mode === "reset_password") && pwFor.length > 0;

  return (
    <Screen
      keyboardAvoiding
      header={
        <ScreenHeader
          title={head.title}
          left={
            onCancel ? (
              <IconButton icon="chevron-left" label={tr("nav.back")} onPress={onCancel} />
            ) : undefined
          }
        />
      }
    >
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Txt tone="muted">{head.sub(email.trim())}</Txt>
        <Card variant="bordered" padding="5">
          <View style={styles.form}>
            {mode === "login" || mode === "register" ? (
              <SegmentedControl
                label={tr("native.auth.mode")}
                options={[
                  { value: "login", label: tr("gate.login") },
                  { value: "register", label: tr("nav.signUp") },
                ]}
                value={mode}
                onChange={(v) => go(v)}
              />
            ) : null}
            {info ? <Notice tone="success">{info}</Notice> : null}
            {error ? <Notice tone="danger">{error}</Notice> : null}

            {(mode === "login" || mode === "register") && onSelectGoogle ? (
              <>
                <Button
                  label={tr(
                    mode === "register"
                      ? "native.auth.google.register"
                      : "native.auth.google.login",
                  )}
                  variant="secondary"
                  size="lg"
                  icon={<GoogleLogo size={18} />}
                  onPress={onSelectGoogle}
                />
                <Txt variant="caption" tone="muted" align="center">
                  {tr("native.auth.or")}
                </Txt>
              </>
            ) : null}

            {mode === "register" ? (
              <>
                <TextField
                  label={tr("edit.fullName")}
                  value={fullName}
                  onChangeText={setFullName}
                  autoComplete="name"
                  textContentType="name"
                />
                <TextField
                  label={tr("edit.username")}
                  value={username}
                  onChangeText={(v) => setUsername(v.toLowerCase())}
                  hint={usernameStatus === "idle" ? tr("edit.username.hint") : usernameMsg[usernameStatus]}
                  error={usernameStatus === "taken" || usernameStatus === "invalid" ? usernameMsg[usernameStatus] : undefined}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username-new"
                  textContentType="username"
                />
              </>
            ) : null}

            {mode !== "confirm_signup" && mode !== "reset_password" ? (
              <TextField
                label={tr("native.auth.email")}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
              />
            ) : null}

            {mode === "login" || mode === "register" ? (
              <TextField
                label={tr("native.auth.password")}
                value={password}
                onChangeText={setPassword}
                secure
                secureToggle
                autoComplete={mode === "register" ? "new-password" : "password"}
                textContentType={mode === "register" ? "newPassword" : "password"}
              />
            ) : null}

            {mode === "confirm_signup" || mode === "reset_password" ? (
              <TextField
                label={tr("native.auth.code")}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
              />
            ) : null}

            {mode === "reset_password" ? (
              <TextField
                label={tr("edit.pw.new")}
                value={newPassword}
                onChangeText={setNewPassword}
                secure
                secureToggle
                autoComplete="new-password"
                textContentType="newPassword"
              />
            ) : null}

            {showPwRules ? (
              <View style={styles.rules} accessibilityLabel={tr("edit.pw.rules")}>
                {RULES.map((r) => {
                  const ok = r.test(pwFor);
                  return (
                    <View key={r.key} style={styles.rule}>
                      <Icon
                        name={ok ? "check" : "x"}
                        size={16}
                        color={ok ? tokens.color.success : tokens.color.textMuted}
                      />
                      <Txt variant="caption" tone={ok ? "success" : "muted"}>
                        {`${tr(r.key)} · ${ok ? tr("edit.pw.ok") : tr("edit.pw.missing")}`}
                      </Txt>
                    </View>
                  );
                })}
              </View>
            ) : null}

            <Button label={submitLabel} size="lg" loading={loading} onPress={submit} />

            {mode === "login" ? (
              <Button
                label={tr("native.auth.forgot.title")}
                variant="ghost"
                onPress={() => go("forgot_password")}
              />
            ) : null}
            {mode === "confirm_signup" ||
            mode === "forgot_password" ||
            mode === "reset_password" ? (
              <Button label={tr("gate.login")} variant="ghost" onPress={() => go("login")} />
            ) : null}
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { padding: tokens.space["5"], gap: tokens.space["4"], paddingBottom: tokens.space["12"] },
  form: { gap: tokens.space["4"] },
  rules: { gap: tokens.space["1"] },
  rule: { flexDirection: "row", alignItems: "center", gap: tokens.space["2"] },
});
