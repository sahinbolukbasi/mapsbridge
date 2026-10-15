/**
 * MapsBridge Email Notification Service (AWS SES & Resilient Notification Store)
 *
 * Delivers price alert emails to users when ticket or hotel deals are discovered.
 * Designed for high concurrency (10k+ users) with batching and error-isolation.
 */

export interface DealNotificationPayload {
  toEmail: string;
  userId?: string;
  dealType: "flight" | "hotel" | "transit";
  title: string;
  origin?: string;
  destination: string;
  dates?: string;
  currentPrice: number;
  originalPrice?: number;
  currency?: string;
  provider?: string;
  bookingUrl?: string;
  details?: string[];
}

export interface EmailDispatchResult {
  success: boolean;
  messageId?: string;
  fallbackStored: boolean;
  recipient: string;
  error?: string;
}

export async function sendDealNotificationEmail(
  payload: DealNotificationPayload,
): Promise<EmailDispatchResult> {
  const currency = payload.currency || "₺";
  const discountPercent =
    payload.originalPrice && payload.originalPrice > payload.currentPrice
      ? Math.round(((payload.originalPrice - payload.currentPrice) / payload.originalPrice) * 100)
      : null;

  const subject =
    payload.dealType === "flight"
      ? `✈️ Ucuz Bilet Alarmı: ${payload.destination} için ${payload.currentPrice.toLocaleString("tr-TR")} ${currency} fırsatı!`
      : `🏨 Fırsat Otel Alarmı: ${payload.destination} için ${payload.currentPrice.toLocaleString("tr-TR")} ${currency}/gece!`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.95; }
    .content { padding: 28px 24px; }
    .badge { display: inline-block; background: #ecfdf5; color: #047857; font-weight: 700; font-size: 12px; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 16px; }
    .deal-card { background: #f1f5f9; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #10b981; }
    .price-tag { font-size: 28px; font-weight: 800; color: #0f172a; margin: 8px 0; }
    .old-price { font-size: 16px; text-decoration: line-through; color: #64748b; font-weight: 500; margin-left: 8px; }
    .savings { color: #059669; font-weight: 700; font-size: 14px; margin-left: 8px; }
    .details-list { margin: 16px 0; padding-left: 20px; font-size: 14px; color: #334155; line-height: 1.6; }
    .cta-btn { display: inline-block; background: #10b981; color: #ffffff !important; font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 10px; text-decoration: none; margin-top: 16px; text-align: center; }
    .footer { padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MapsBridge Fiyat Takip Botu</h1>
      <p>Seyahatin için aradığın uygun fiyat bulundu!</p>
    </div>
    <div class="content">
      <span class="badge">${payload.dealType === "flight" ? "Uçak / Ulaşım Fırsatı" : "Otel / Konaklama Fırsatı"}</span>
      <h2>${payload.title}</h2>
      
      <div class="deal-card">
        <div><strong>Hedef:</strong> ${payload.destination} ${payload.origin ? `(${payload.origin} kalkışlı)` : ""}</div>
        ${payload.dates ? `<div><strong>Tarihler:</strong> ${payload.dates}</div>` : ""}
        ${payload.provider ? `<div><strong>Sağlayıcı:</strong> ${payload.provider}</div>` : ""}
        <div class="price-tag">
          ${payload.currentPrice.toLocaleString("tr-TR")} ${currency}
          ${payload.originalPrice ? `<span class="old-price">${payload.originalPrice.toLocaleString("tr-TR")} ${currency}</span>` : ""}
          ${discountPercent ? `<span class="savings">▼ %${discountPercent} İndirim</span>` : ""}
        </div>
      </div>

      ${
        payload.details && payload.details.length > 0
          ? `
        <h4>Öne Çıkan Detaylar:</h4>
        <ul class="details-list">
          ${payload.details.map((d) => `<li>${d}</li>`).join("")}
        </ul>
      `
          : ""
      }

      ${
        payload.bookingUrl
          ? `
        <div style="text-align: center;">
          <a href="${payload.bookingUrl}" class="cta-btn" target="_blank" rel="noopener noreferrer">Fırsatı İncele & Rezervasyon Yap</a>
        </div>
      `
          : `
        <div style="text-align: center;">
          <a href="https://mapsbridge.com/panel/" class="cta-btn" target="_blank" rel="noopener noreferrer">Seyahat Paneline Git</a>
        </div>
      `
      }
    </div>
    <div class="footer">
      Bu e-posta, MapsBridge yapay zeka asistanı üzerinden oluşturduğun fiyat takip alarmı kapsamında gönderilmiştir.<br>
      © 2026 MapsBridge Seyahat Teknolojileri.
    </div>
  </div>
</body>
</html>
  `;

  let sesSuccess = false;
  let messageId: string | undefined;

  // 1. Try AWS SES Dispatch
  try {
    const senderEmail = process.env.SES_SENDER_EMAIL || "bildirim@mapsbridge.com";
    const region = process.env.AWS_REGION || "eu-central-1";

    // Dynamic import to support execution in environments with or without SES layer
    const sesModule = await import("@aws-sdk/client-ses").catch(() => null);
    if (sesModule) {
      const client = new sesModule.SESClient({ region });
      const command = new sesModule.SendEmailCommand({
        Source: senderEmail,
        Destination: {
          ToAddresses: [payload.toEmail],
        },
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: htmlContent, Charset: "UTF-8" },
          },
        },
      });

      const res = await client.send(command);
      messageId = res.MessageId;
      sesSuccess = true;
    }
  } catch (err: any) {
    console.warn(
      `[EmailNotifier] SES send warning: ${err?.message || err}. Saving notification to user store.`,
    );
  }

  // 2. Persist notification into DynamoDB for in-app alert inbox
  let fallbackStored = false;
  try {
    const tableName = process.env.DYNAMODB_TABLE || "adreskopru-prod-data";
    const { DynamoDBClient, PutItemCommand } = await import("@aws-sdk/client-dynamodb");
    const { marshall } = await import("@aws-sdk/util-dynamodb");
    const ddb = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-central-1" });

    const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const pk = payload.userId ? `USER#${payload.userId}` : `EMAIL#${payload.toEmail.toLowerCase()}`;

    await ddb.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall({
          PK: pk,
          SK: `DEAL_ALERT#${Date.now()}`,
          id: notifId,
          type: payload.dealType,
          title: payload.title,
          subject,
          toEmail: payload.toEmail,
          currentPrice: payload.currentPrice,
          originalPrice: payload.originalPrice,
          currency,
          destination: payload.destination,
          bookingUrl: payload.bookingUrl,
          sentViaSes: sesSuccess,
          sesMessageId: messageId,
          read: false,
          createdAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
        }),
      }),
    );
    fallbackStored = true;
  } catch (err) {
    console.error("[EmailNotifier] Failed to persist deal notification:", err);
  }

  return {
    success: sesSuccess || fallbackStored,
    messageId,
    fallbackStored,
    recipient: payload.toEmail,
  };
}
