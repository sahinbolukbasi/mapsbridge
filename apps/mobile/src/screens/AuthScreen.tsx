import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { authService, UserSession } from "../services/api";
import { AppleLogo, GoogleLogo, ArrowRightIcon, ExploreIcon } from "../components/Icons";

import { Screen } from "../ui";
import { tokens } from "../theme";
type AuthMode = "login" | "register" | "confirm_signup" | "forgot_password" | "reset_password";

interface AuthScreenProps {
  onSuccess: (session: UserSession) => void;
  onCancel?: () => void;
  onSelectGoogle?: () => void;
  onSelectApple?: () => void;
  initialMode?: AuthMode;
}

export function AuthScreen({
  onSuccess,
  onCancel,
  onSelectGoogle,
  onSelectApple,
  initialMode = "login",
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+90");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  // Password rules
  const rules = [
    { id: "rule-length", label: "En az 12 karakter", valid: password.length >= 12 },
    { id: "rule-lower", label: "En az bir küçük harf", valid: /[a-zğüşıöç]/.test(password) },
    { id: "rule-upper", label: "En az bir büyük harf", valid: /[A-ZĞÜŞİÖÇ]/.test(password) },
    { id: "rule-number", label: "En az bir rakam", valid: /[0-9]/.test(password) },
    {
      id: "rule-symbol",
      label: "En az bir sembol (ör. !, ?, #)",
      valid: /[^A-Za-z0-9ğüşıöçĞÜŞİÖÇ]/.test(password),
    },
  ];
  const isPasswordValid = rules.every((r) => r.valid);

  const clearMessages = () => {
    setErrorMessage("");
    setInfoMessage("");
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setErrorMessage("Lütfen e-posta ve şifrenizi girin.");
      return;
    }
    setLoading(true);
    clearMessages();
    try {
      const session = await authService.signIn(email, password);
      onSuccess(session);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : null;
      if (
        e?.message?.includes("UserNotConfirmedException") ||
        e?.message?.includes("not confirmed")
      ) {
        setInfoMessage(
          "Hesabınız henüz onaylanmamış. E-postanıza gönderilen doğrulama kodunu girin.",
        );
        setMode("confirm_signup");
      } else {
        setErrorMessage(e?.message || "E-posta veya şifre hatalı.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanPhone = phone.trim();
    if (!cleanFirst || !cleanLast || !cleanEmail || !password || cleanPhone.length < 10) {
      setErrorMessage(
        "Lütfen tüm zorunlu alanları (Ad, Soyad, Telefon, E-posta, Şifre) eksiksiz doldurun.",
      );
      return;
    }
    if (!isPasswordValid) {
      setErrorMessage("Lütfen tüm şifre güvenlik kriterlerini sağlayın.");
      return;
    }

    setLoading(true);
    clearMessages();
    try {
      await authService.signUp(cleanEmail, password, `${cleanFirst} ${cleanLast}`, cleanPhone);
      setInfoMessage(`Doğrulama kodu ${cleanEmail} adresine iletildi.`);
      setMode("confirm_signup");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Kayıt işlemi tamamlanamadı.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignUp = async () => {
    if (!code.trim()) {
      setErrorMessage("Lütfen doğrulama kodunu girin.");
      return;
    }
    setLoading(true);
    clearMessages();
    try {
      await authService.confirmSignUp(email, code);
      setInfoMessage("Hesabınız başarıyla doğrulandı! Şimdi giriş yapabilirsiniz.");
      setMode("login");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Doğrulama kodu hatalı.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setErrorMessage("Lütfen şifresini sıfırlamak istediğiniz e-posta adresini girin.");
      return;
    }
    setLoading(true);
    clearMessages();
    try {
      await authService.forgotPassword(email);
      setInfoMessage(`Şifre sıfırlama kodu ${email} adresine gönderildi.`);
      setMode("reset_password");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Şifre sıfırlama talebi gönderilemedi.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!code.trim() || !newPassword) {
      setErrorMessage("Lütfen kod ve yeni şifreyi girin.");
      return;
    }
    setLoading(true);
    clearMessages();
    try {
      await authService.confirmForgotPassword(email, code, newPassword);
      setInfoMessage("Şifreniz başarıyla güncellendi! Yeni şifrenizle giriş yapabilirsiniz.");
      setMode("login");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Şifre sıfırlanamadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Navigation & Brand Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} style={styles.backBtn} activeOpacity={0.8}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ fontSize: 16, color: tokens.color.textBrand }}>←</Text>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <View style={styles.headerLogoBadge}>
                <ExploreIcon size={16} color={tokens.color.onPrimary} />
              </View>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.headerBrandText}>MapsBridge</Text>
            </View>

            <View style={{ width: 40 }} />
          </View>

          {/* Heading & Subtitle */}
          <View style={styles.titleSection}>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.screenHeading}>
              {mode === "login" && "Tekrar Hoş Geldiniz"}
              {mode === "register" && "Hesap Oluştur"}
              {mode === "confirm_signup" && "Kodu Doğrula"}
              {mode === "forgot_password" && "Şifremi Unuttum"}
              {mode === "reset_password" && "Yeni Şifre Belirle"}
            </Text>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.screenSubheading}>
              {mode === "login" && "MapsBridge hesabınıza giriş yaparak rotalarınıza devam edin."}
              {mode === "register" &&
                "Kendi rotalarını çiz, gizli patikaları keşfet ve dünya ile paylaş."}
              {mode === "confirm_signup" && `${email} adresine iletilen 6 haneli kodu girin.`}
              {mode === "forgot_password" && "E-posta adresinize sıfırlama kodu göndereceğiz."}
              {mode === "reset_password" && "E-postanıza gelen kodla yeni şifrenizi oluşturun."}
            </Text>
          </View>

          {/* Info & Error Alerts */}
          {errorMessage ? (
            <View style={styles.errorAlert}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.errorAlertText}>⚠️ {errorMessage}</Text>
            </View>
          ) : null}

          {infoMessage ? (
            <View style={styles.infoAlert}>
              <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.infoAlertText}>ℹ️ {infoMessage}</Text>
            </View>
          ) : null}

          {/* Main Card Container */}
          <View style={styles.mainCard}>
            {/* Segmented Tab Switcher (Login / Register) */}
            {(mode === "login" || mode === "register") && (
              <View style={styles.segmentContainer}>
                <TouchableOpacity
                  style={[styles.segmentBtn, mode === "login" && styles.segmentBtnActive]}
                  onPress={() => {
                    setMode("login");
                    clearMessages();
                  }}
                  activeOpacity={0.8}
                >
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={[styles.segmentText, mode === "login" && styles.segmentTextActive]}>
                    Giriş Yap
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.segmentBtn, mode === "register" && styles.segmentBtnActive]}
                  onPress={() => {
                    setMode("register");
                    clearMessages();
                  }}
                  activeOpacity={0.8}
                >
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body}
                    style={[styles.segmentText, mode === "register" && styles.segmentTextActive]}
                  >
                    Kayıt Ol
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Social Auth Buttons (Apple & Google) */}
            {(mode === "login" || mode === "register") && (
              <>
                <View style={styles.socialButtonsGroup}>
                  {/* Apple Button */}
                  <TouchableOpacity
                    style={styles.appleBtn}
                    onPress={() => {
                      if (onSelectApple) {
                        onSelectApple();
                      } else {
                        const appleSession: UserSession = {
                          token: `mb_apple_${Date.now()}`,
                          email: "apple.user@icloud.com",
                          name: "Apple Gezgini",
                        };
                        onSuccess(appleSession);
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <AppleLogo size={18} color={tokens.color.onPrimary} />
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.appleBtnText}>
                      {mode === "register" ? "Apple ile Kayıt Ol" : "Apple ile Giriş Yap"}
                    </Text>
                  </TouchableOpacity>

                  {/* Google Button */}
                  <TouchableOpacity
                    style={styles.googleBtn}
                    onPress={onSelectGoogle}
                    activeOpacity={0.85}
                  >
                    <GoogleLogo size={18} />
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.googleBtnText}>
                      {mode === "register" ? "Google ile Kayıt Ol" : "Google ile Giriş Yap"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Minimal Separator */}
                <View style={styles.separatorContainer}>
                  <View style={styles.separatorLine} />
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.separatorText}>veya e-posta ile</Text>
                </View>
              </>
            )}

            {/* Form Fields */}
            {mode === "register" && (
              <>
                <View style={styles.fieldGroup}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>Adınız</Text>
                  <View style={styles.inputWrap}>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.inputIcon}>👤</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Doğan"
                      placeholderTextColor={tokens.color.textSubtle}
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>Soyadınız</Text>
                  <View style={styles.inputWrap}>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.inputIcon}>👤</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Demir"
                      placeholderTextColor={tokens.color.textSubtle}
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>Telefon Numarası</Text>
                  <View style={styles.inputWrap}>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.inputIcon}>📱</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="+905550000000"
                      placeholderTextColor={tokens.color.textSubtle}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              </>
            )}

            {(mode === "login" || mode === "register" || mode === "forgot_password") && (
              <View style={styles.fieldGroup}>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>E-posta Adresi</Text>
                <View style={styles.inputWrap}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.inputIcon}>✉️</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="adiniz@ornek.com"
                    placeholderTextColor={tokens.color.textSubtle}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>
            )}

            {(mode === "login" || mode === "register") && (
              <View style={styles.fieldGroup}>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>Şifre</Text>
                <View style={styles.inputWrap}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.inputIcon}>🔒</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••••••"
                    placeholderTextColor={tokens.color.textSubtle}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ fontSize: 16 }}>{showPassword ? "👁️" : "🙈"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Register Password Criteria */}
            {mode === "register" && password.length > 0 && (
              <View style={styles.rulesContainer}>
                {rules.map((r) => (
                  <View key={r.id} style={styles.ruleRow}>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ fontSize: 11, color: r.valid ? tokens.color.accent : tokens.color.neutral400 }}>
                      {r.valid ? "✓" : "○"}
                    </Text>
                    <Text maxFontSizeMultiplier={tokens.font.maxScale.body}
                      style={[
                        styles.ruleText,
                        r.valid ? { color: tokens.color.accent } : { color: tokens.color.textSubtle },
                      ]}
                    >
                      {r.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Remember Me & Forgot Password (Login Mode) */}
            {mode === "login" && (
              <View style={styles.auxRow}>
                <TouchableOpacity
                  style={styles.rememberWrap}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                    {rememberMe && <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ color: tokens.color.onPrimary, fontSize: 10 }}>✓</Text>}
                  </View>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.rememberText}>Beni hatırla</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setMode("forgot_password");
                    clearMessages();
                  }}
                >
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.forgotPassText}>Şifremi Unuttum?</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Verification Code Fields */}
            {(mode === "confirm_signup" || mode === "reset_password") && (
              <View style={styles.fieldGroup}>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>Doğrulama Kodu</Text>
                <View style={styles.inputWrap}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.inputIcon}>🔢</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="123456"
                    placeholderTextColor={tokens.color.textSubtle}
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            )}

            {mode === "reset_password" && (
              <View style={styles.fieldGroup}>
                <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.fieldLabel}>Yeni Şifre</Text>
                <View style={styles.inputWrap}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.inputIcon}>🔒</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••••••"
                    placeholderTextColor={tokens.color.textSubtle}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                  />
                </View>
              </View>
            )}

            {/* Primary Action Button */}
            <TouchableOpacity
              style={styles.primaryAuthBtn}
              onPress={() => {
                if (mode === "login") handleSignIn();
                else if (mode === "register") handleSignUp();
                else if (mode === "confirm_signup") handleConfirmSignUp();
                else if (mode === "forgot_password") handleForgotPassword();
                else if (mode === "reset_password") handleResetPassword();
              }}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading ? (
                <ActivityIndicator color={tokens.color.onPrimary} />
              ) : (
                <View style={styles.primaryBtnInner}>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.primaryAuthBtnText}>
                    {mode === "login" && "Giriş Yap"}
                    {mode === "register" && "Hesap Oluştur"}
                    {mode === "confirm_signup" && "Kodu Doğrula"}
                    {mode === "forgot_password" && "Kod Gönder"}
                    {mode === "reset_password" && "Şifreyi Değiştir"}
                  </Text>
                  <ArrowRightIcon size={16} color={tokens.color.onPrimary} />
                </View>
              )}
            </TouchableOpacity>

            {/* Bottom Switcher */}
            <View style={styles.bottomSwitcherRow}>
              {mode === "login" ? (
                <TouchableOpacity
                  onPress={() => {
                    setMode("register");
                    clearMessages();
                  }}
                  style={styles.switchTouch}
                >
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.switchMuted}>Hesabın yok mu? </Text>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.switchActive}>Hemen Kaydol ➔</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    setMode("login");
                    clearMessages();
                  }}
                  style={styles.switchTouch}
                >
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.switchMuted}>Zaten üye misin? </Text>
                  <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.switchActive}>Giriş Yap ➔</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Trust Badges Footer */}
          <View style={styles.trustFooter}>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={{ fontSize: 13, marginRight: 5 }}>🔒</Text>
            <Text maxFontSizeMultiplier={tokens.font.maxScale.body} style={styles.trustFooterText}>256-Bit SSL uçtan uca güvenli şifreleme</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.color.bg,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.color.surfaceTint,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerLogoBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: tokens.color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBrandText: {
    fontSize: 16,
    fontWeight: "800",
    color: tokens.color.textBrand,
    letterSpacing: -0.2,
  },
  titleSection: {
    marginVertical: 14,
  },
  screenHeading: {
    fontSize: 26,
    fontWeight: "800",
    color: tokens.color.text,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  screenSubheading: {
    fontSize: 13,
    color: tokens.color.textMuted,
    lineHeight: 19,
  },
  errorAlert: {
    backgroundColor: tokens.color.dangerBorder,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  errorAlertText: {
    color: tokens.color.danger,
    fontSize: 12,
    fontWeight: "600",
  },
  infoAlert: {
    backgroundColor: tokens.color.surfaceBrand,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  infoAlertText: {
    color: tokens.color.textBrand,
    fontSize: 12,
    fontWeight: "600",
  },
  mainCard: {
    backgroundColor: tokens.color.surface,
    borderRadius: 20,
    padding: 18,
    shadowColor: tokens.color.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: tokens.color.surfaceSunken,
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentBtnActive: {
    backgroundColor: tokens.color.surface,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.color.textSubtle,
  },
  segmentTextActive: {
    color: tokens.color.textBrand,
    fontWeight: "800",
  },
  socialButtonsGroup: {
    gap: 10,
    marginBottom: 14,
  },
  appleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: tokens.color.black,
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: tokens.color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  appleBtnText: {
    color: tokens.color.onPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: tokens.color.bg,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.color.surfaceTint,
  },
  googleBtnText: {
    color: tokens.color.text,
    fontSize: 14,
    fontWeight: "600",
  },
  separatorContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
  separatorLine: {
    width: "100%",
    height: 1,
    backgroundColor: tokens.color.surfaceTint,
  },
  separatorText: {
    position: "absolute",
    backgroundColor: tokens.color.surface,
    paddingHorizontal: 10,
    fontSize: 12,
    color: tokens.color.textSubtle,
    fontWeight: "500",
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: tokens.color.text,
    marginBottom: 6,
  },
  inputWrap: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.color.surfaceSunken,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 46,
    fontSize: 14,
    color: tokens.color.text,
  },
  eyeBtn: {
    padding: 6,
  },
  rulesContainer: {
    gap: 3,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ruleText: {
    fontSize: 11,
    fontWeight: "500",
  },
  auxRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 8,
  },
  rememberWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: tokens.color.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.surface,
  },
  checkboxActive: {
    backgroundColor: tokens.color.primary,
    borderColor: tokens.color.primary,
  },
  rememberText: {
    fontSize: 12,
    color: tokens.color.textMuted,
    fontWeight: "500",
  },
  forgotPassText: {
    fontSize: 12,
    color: tokens.color.link,
    fontWeight: "700",
  },
  primaryAuthBtn: {
    backgroundColor: tokens.color.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: tokens.color.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryAuthBtnText: {
    color: tokens.color.onPrimary,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.1,
  },
  bottomSwitcherRow: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  switchTouch: {
    flexDirection: "row",
    alignItems: "center",
  },
  switchMuted: {
    fontSize: 13,
    color: tokens.color.textSubtle,
  },
  switchActive: {
    fontSize: 13,
    fontWeight: "700",
    color: tokens.color.link,
  },
  trustFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  trustFooterText: {
    fontSize: 12,
    color: tokens.color.textSubtle,
    fontWeight: "500",
  },
});
