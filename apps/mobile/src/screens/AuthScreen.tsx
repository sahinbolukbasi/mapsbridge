import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { authService, type UserSession } from "../services/api";
import { storage } from "../services/storage";
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

// F3: Kullanıcı adı kuralı backend ile birebir (auth/index.ts handlePublishProfile):
// 3–30 karakter, yalnız küçük harf/rakam/alt çizgi. İstemci doğrulaması bununla hizalı
// olmalı; aksi halde yayınlama (POST /profile/publish) 400 döner.
const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

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
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid" | "unknown"
  >("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

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

  // F3: Kayıt sonrası seçilen kullanıcı adını ilk girişte yayınla. Kayıt anında token yok;
  // kullanıcı adı cihaza yazılır (mb_pending_username) ve burada giriş başarılı olunca
  // mevcut public POST /profile/publish ile yayınlanır. Hata sessizce yutulur (profil
  // yayınlama başarısızlığı girişi bloklamaz; kullanıcı profilinden tekrar deneyebilir).
  const publishPendingProfile = async (token: string) => {
    try {
      const pendingUser = await storage.getItem("mb_pending_username");
      if (!pendingUser) return;
      const pendingName = (await storage.getItem("mb_pending_fullname")) || "";
      const [firstName, ...rest] = pendingName.trim().split(/\s+/);
      await authService.publishProfile(token, pendingUser, {
        firstName: firstName || "Gezgin",
        lastName: rest.join(" "),
      });
      await storage.removeItem("mb_pending_username");
      await storage.removeItem("mb_pending_fullname");
    } catch {
      // yoksayılır — profil yayınlama girişi bloklamaz
    }
  };

  const finishSignIn = async (session: UserSession) => {
    await publishPendingProfile(session.token);
    onSuccess(session);
  };

  const signIn = () => {
    if (!email.trim() || !password) {
      setError(tr("native.auth.err.loginFields"));
      return;
    }
    run(async () => {
      try {
        await finishSignIn(await authService.signIn(email, password));
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

  // F3: kullanıcı adı uygunluğu (debounce + mevcut public GET /profiles/{username}).
  useEffect(() => {
    if (mode !== "register") return;
    const raw = username.trim().toLowerCase();
    if (!raw) {
      setUsernameStatus("idle");
      return;
    }
    if (!USERNAME_RE.test(raw)) {
      setUsernameStatus("invalid");
      return;
    }
    setUsernameStatus("checking");
    let active = true;
    const t = setTimeout(() => {
      authService.checkUsername(raw).then((st) => {
        if (active) setUsernameStatus(st);
      });
    }, 450);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [username, mode]);

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
      // Token kayıt anında yok; seçilen kullanıcı adını cihaza yaz, ilk girişte yayınlanır.
      try {
        await storage.setItem("mb_pending_username", cleanUser);
        await storage.setItem("mb_pending_fullname", fullName.trim());
      } catch {
        // yoksayılır
      }
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

  const usernameHint =
    usernameStatus === "checking"
      ? tr("native.auth.username.checking")
      : usernameStatus === "available"
        ? tr("native.auth.username.available")
        : usernameStatus === "taken"
          ? tr("native.auth.username.taken")
          : usernameStatus === "invalid"
            ? tr("native.auth.username.invalid")
            : tr("native.auth.username.help");

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
                  icon={<GoogleLogo size={20} />}
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
                  label={tr("native.auth.fullName")}
                  value={fullName}
                  onChangeText={setFullName}
                  autoComplete="name"
                  textContentType="name"
                />
                <TextField
                  label={tr("edit.username")}
                  value={username}
                  onChangeText={(t) => setUsername(t.toLowerCase())}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  hint={usernameHint}
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
              /* J (görev 14): şifre göster/gizle alan İÇİNDE göz simgesi (ayrı altsatır düğme yok). */
              <TextField
                label={tr("native.auth.password")}
                value={password}
                onChangeText={setPassword}
                secure={!showPassword}
                autoComplete={mode === "register" ? "new-password" : "password"}
                textContentType={mode === "register" ? "newPassword" : "password"}
                endAdornment={
                  <IconButton
                    icon={showPassword ? "eye-off" : "eye"}
                    label={showPassword ? tr("edit.pw.hide") : tr("edit.pw.show")}
                    selected={showPassword}
                    onPress={() => setShowPassword((v) => !v)}
                  />
                }
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
                secure={!showPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                endAdornment={
                  <IconButton
                    icon={showPassword ? "eye-off" : "eye"}
                    label={showPassword ? tr("edit.pw.hide") : tr("edit.pw.show")}
                    selected={showPassword}
                    onPress={() => setShowPassword((v) => !v)}
                  />
                }
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
