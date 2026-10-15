/**
 * MapsBridge Cognito Custom Message Trigger
 * Intercepts Cognito verification emails and formats them using modern MapsBridge HTML templates.
 * Trigger Sources:
 *  - CustomMessage_ForgotPassword: Password reset verification code
 *  - CustomMessage_SignUp: New user sign-up confirmation code
 *  - CustomMessage_ResendCode: Resent verification code
 */

import { generatePasswordResetEmailHtml, generateSignUpEmailHtml } from "./email-templates";

export interface CognitoCustomMessageEvent {
  version: string;
  triggerSource: string;
  region: string;
  userPoolId: string;
  userName: string;
  callerContext: {
    awsSdkVersion: string;
    clientId: string;
  };
  request: {
    userAttributes: Record<string, string>;
    codeParameter: string;
    linkParameter?: string;
    usernameParameter?: string;
  };
  response: {
    smsMessage: string | null;
    emailMessage: string | null;
    emailSubject: string | null;
  };
}

export const handler = async (
  event: CognitoCustomMessageEvent,
): Promise<CognitoCustomMessageEvent> => {
  console.log(
    `[CognitoCustomMessage] triggerSource: ${event.triggerSource}, user: ${event.userName}`,
  );

  const email = event.request.userAttributes?.email || event.userName || "";
  const name = event.request.userAttributes?.name || "Gezgin";
  const code = event.request.codeParameter || "{####}";

  try {
    if (event.triggerSource === "CustomMessage_ForgotPassword") {
      event.response.emailSubject = "MapsBridge - Şifre Sıfırlama Kodun Hazır";
      event.response.emailMessage = generatePasswordResetEmailHtml({
        name,
        email,
        code,
      });
    } else if (
      event.triggerSource === "CustomMessage_SignUp" ||
      event.triggerSource === "CustomMessage_ResendCode"
    ) {
      event.response.emailSubject = "MapsBridge - Hesap Doğrulama Kodun Hazır";
      event.response.emailMessage = generateSignUpEmailHtml({
        name,
        email,
        code,
      });
    }
  } catch (error) {
    console.error("[CognitoCustomMessage] Failed to customize email message:", error);
    // Return original event so Cognito can fallback to default rather than failing
  }

  return event;
};
