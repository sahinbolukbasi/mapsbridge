import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { authService, type UserSession } from "../services/api";
import {
  Button,
  Card,
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

const RULES = [
  { key: "edit.pw.rule.length", test: (p: string) => p.length >= 12 },
  { key: "edit.pw.rule.lower", test: (p: string) => /[a-zğüşıöç]/.test(p) },
  { key: "edit.pw.rule.upper", test: (p: string) => /[A-ZĞÜŞİÖÇ]/.test(p) },
  { key: "edit.pw.rule.digit", test: (p: string) => /[0-9]/.test(p) },
  { key: "edit.pw.rule.symbol", test: (p: string) => /[^A-Za-z0-9ğüşıöçĞÜŞİÖÇ]/.test(p) },
] as const;

const TITLES: Record<AuthMode, { title: string; sub: (email: string) => string }> = {
  login: { title: "Giriş yap", sub: () => "Rotalarına ve asistana kaldığın yerden devam et." },
  register: {
    title: "Ücretsiz hesap aç",
    sub: () => "Rotalarını hesabında sakla, asistanla taslak rotanı oluştur.",
  },
  confirm_signup: {
    title: "E-postanı doğrula",
    sub: (email) => `${email} adresine gönderilen 6 haneli kodu gir.`,
  },
  forgot_password: {
    title: "Şifremi unuttum",
    sub: () => "E-posta adresine bir sıfırlama kodu göndereceğiz.",
  },
  reset_password: {
    title: "Yeni şifre belirle",
    sub: () => "E-postana gelen kodla yeni şifreni oluştur.",
  },
};

export function AuthScreen({
  onSuccess,
  onCancel,
  onSelectGoogle,
  initialMode = "login",
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+90");
  const [password, setPassword] = useState("");
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

  const signIn = () => {
    if (!email.trim() || !password) {
      setError("E-posta ve şifreni gir.");
      return;
    }
    run(async () => {
      try {
        onSuccess(await authService.signIn(email, password));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("UserNotConfirmedException") || msg.includes("not confirmed")) {
          setInfo("Hesabın henüz doğrulanmadı. E-postana gönderilen kodu gir.");
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
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !cleanEmail ||
      !password ||
      phone.trim().length < 10
    ) {
      setError("Ad, soyad, telefon, e-posta ve şifre zorunlu.");
      return;
    }
    if (!pwValid) {
      setError(tr("edit.pw.invalid"));
      return;
    }
    run(async () => {
      await authService.signUp(
        cleanEmail,
        password,
        `${firstName.trim()} ${lastName.trim()}`,
        phone.trim(),
      );
      setInfo(`Doğrulama kodu ${cleanEmail} adresine gönderildi.`);
      setMode("confirm_signup");
    });
  };

  const confirm = () => {
    if (!code.trim()) {
      setError("Doğrulama kodunu gir.");
      return;
    }
    run(async () => {
      await authService.confirmSignUp(email, code);
      setInfo("Hesabın doğrulandı. Şimdi giriş yapabilirsin.");
      setMode("login");
    });
  };

  const forgot = () => {
    if (!email.trim()) {
      setError("Şifresini sıfırlamak istediğin e-posta adresini gir.");
      return;
    }
    run(async () => {
      await authService.forgotPassword(email);
      setInfo(`Sıfırlama kodu ${email} adresine gönderildi.`);
      setMode("reset_password");
    });
  };

  const reset = () => {
    if (!code.trim() || !newPassword) {
      setError("Kodu ve yeni şifreni gir.");
      return;
    }
    if (!pwValid) {
      setError(tr("edit.pw.invalid"));
      return;
    }
    run(async () => {
      await authService.confirmForgotPassword(email, code, newPassword);
      setInfo("Şifren güncellendi. Yeni şifrenle giriş yapabilirsin.");
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
    login: "Giriş yap",
    register: "Hesabı oluştur",
    confirm_signup: "Kodu doğrula",
    forgot_password: "Kodu gönder",
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
                label="Hesap"
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
                  label={mode === "register" ? "Google ile kayıt ol" : "Google ile giriş yap"}
                  variant="secondary"
                  size="lg"
                  icon={<Icon name="globe" size={20} color={tokens.color.buttonSecondaryFg} />}
                  onPress={onSelectGoogle}
                />
                <Txt variant="caption" tone="muted" align="center">
                  veya e-posta ile
                </Txt>
              </>
            ) : null}

            {mode === "register" ? (
              <>
                <TextField
                  label="Ad"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoComplete="given-name"
                  textContentType="givenName"
                />
                <TextField
                  label="Soyad"
                  value={lastName}
                  onChangeText={setLastName}
                  autoComplete="family-name"
                  textContentType="familyName"
                />
                <TextField
                  label="Telefon"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                />
              </>
            ) : null}

            {mode !== "confirm_signup" && mode !== "reset_password" ? (
              <TextField
                label="E-posta"
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
                label="Şifre"
                value={password}
                onChangeText={setPassword}
                secure
                autoComplete={mode === "register" ? "new-password" : "password"}
                textContentType={mode === "register" ? "newPassword" : "password"}
              />
            ) : null}

            {mode === "confirm_signup" || mode === "reset_password" ? (
              <TextField
                label="Doğrulama kodu"
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
                label="Şifremi unuttum"
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
