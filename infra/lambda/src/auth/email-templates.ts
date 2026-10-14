/**
 * MapsBridge Transactional Email Templates
 * Matches Stitch Screen: MapsBridge - Şifre Sıfırlama E-Posta Şablonu (ID: df7e142620cc41ce8d8ca338f3cffd07)
 */

export function generatePasswordResetEmailHtml(params: {
  name?: string;
  email?: string;
  code: string;
}): string {
  const recipientName = params.name && params.name.trim() ? params.name.trim() : "Gezgin";
  const recipientEmail = params.email && params.email.trim() ? params.email.trim() : "";
  const code = params.code || "{####}";
  const directResetUrl = recipientEmail
    ? `https://mapsbridge.com/sifre-sifirla/?email=${encodeURIComponent(recipientEmail)}&code=${code}&step=confirm`
    : `https://mapsbridge.com/sifre-sifirla/?step=confirm`;

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MapsBridge - Şifre Sıfırlama Doğrulama Kodu</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f2f4f7; margin: 0; padding: 0; width: 100% !important; }
  </style>
</head>
<body style="background-color: #f2f4f7; margin: 0; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 20px 50px rgba(30, 77, 62, 0.08);">
    
    <!-- Top Decorative Brand Bar -->
    <tr>
      <td height="8" style="background: linear-gradient(90deg, #1e4d3e 0%, #2d735d 50%, #10b981 100%); line-height: 8px; font-size: 0;">&nbsp;</td>
    </tr>

    <!-- Header -->
    <tr>
      <td style="padding: 28px 32px 20px; border-bottom: 1px solid #f1f5f9;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="left" style="vertical-align: middle;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="38" height="38" style="background-color: #1e4d3e; border-radius: 12px; text-align: center; vertical-align: middle;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle;">
                      <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                  </td>
                  <td style="padding-left: 12px;">
                    <span style="font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: #1e4d3e; display: block; line-height: 22px;">MapsBridge</span>
                    <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: #64748b; text-transform: uppercase; display: block; line-height: 14px; margin-top: 2px;">GÜVENLİK VE DOĞRULAMA</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Main Content -->
    <tr>
      <td style="padding: 32px 32px 16px;">
        <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0; letter-spacing: -0.02em;">
          Şifre Sıfırlama Kodu
        </h1>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
          Merhaba <strong>${recipientName}</strong>, MapsBridge hesabının şifresini yenilemek için talepte bulundun. Aşağıdaki 6 haneli kodu kullanarak şifreni hemen güncelleyebilirsin:
        </p>

        <!-- Big Verification Code Display -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 16px; text-align: center;">
          <tr>
            <td style="padding: 24px 16px;">
              <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">
                6 HANELİ TEK KULLANIMLIK KOD
              </div>
              <div style="display: inline-block; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px 28px; font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 32px; font-weight: 800; letter-spacing: 0.35em; color: #1e4d3e; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); margin: 6px 0;">
                ${code}
              </div>
              <div style="font-size: 12px; font-weight: 600; color: #64748b; margin-top: 10px;">
                ⏱ Bu kod <strong>15 dakika</strong> boyunca geçerlidir.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Direct 1-Click Action Button -->
    <tr>
      <td style="padding: 8px 32px 16px; text-align: center;">
        <a href="${directResetUrl}" target="_blank" style="display: block; width: 100%; box-sizing: border-box; text-decoration: none; padding: 15px 24px; border-radius: 12px; background-color: #1e4d3e; color: #ffffff; font-weight: 700; font-size: 14px; text-align: center; box-shadow: 0 4px 12px rgba(30, 77, 62, 0.25);">
          Şifremi Doğrudan Sıfırla &rarr;
        </a>
      </td>
    </tr>

    <!-- Footer Links -->
    <tr>
      <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8;">
        <p style="margin: 0 0 8px 0;">
          <a href="https://mapsbridge.com/destek" style="color: #64748b; text-decoration: none;">Yardım Merkezi</a> &nbsp;&bull;&nbsp; 
          <a href="https://mapsbridge.com/gizlilik" style="color: #64748b; text-decoration: none;">Gizlilik İlkeleri</a> &nbsp;&bull;&nbsp; 
          <a href="https://mapsbridge.com/kosullar" style="color: #64748b; text-decoration: none;">Kullanım Koşulları</a>
        </p>
        <p style="margin: 0; font-size: 11px; color: #cbd5e1;">
          &copy; 2026 MapsBridge Inc. Akıllı Seyahat &amp; Rota Platformu. Tüm hakları saklıdır.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function generateSignUpEmailHtml(params: {
  name?: string;
  email?: string;
  code: string;
}): string {
  const recipientName = params.name && params.name.trim() ? params.name.trim() : "Gezgin";
  const recipientEmail = params.email && params.email.trim() ? params.email.trim() : "";
  const code = params.code || "{####}";
  const directVerifyUrl = recipientEmail
    ? `https://mapsbridge.com/dogrula/?email=${encodeURIComponent(recipientEmail)}&code=${code}`
    : `https://mapsbridge.com/dogrula/`;

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MapsBridge - Hesap Doğrulama Kodu</title>
</head>
<body style="background-color: #f2f4f7; margin: 0; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 20px 50px rgba(30, 77, 62, 0.08);">
    <tr>
      <td height="8" style="background: linear-gradient(90deg, #1e4d3e 0%, #2d735d 50%, #10b981 100%); line-height: 8px; font-size: 0;">&nbsp;</td>
    </tr>
    <tr>
      <td style="padding: 28px 32px 20px; border-bottom: 1px solid #f1f5f9;">
        <span style="font-size: 20px; font-weight: 800; color: #1e4d3e;">MapsBridge</span>
      </td>
    </tr>
    <tr>
      <td style="padding: 28px 32px;">
        <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 10px 0;">Hoş Geldin, ${recipientName}!</h1>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
          MapsBridge hesabını aktif hale getirmek için lütfen aşağıdaki 6 haneli doğrulama kodunu kullan:
        </p>
        <div style="text-align: center; background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 16px; padding: 20px; margin: 16px 0;">
          <div style="display: inline-block; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px 28px; font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 0.35em; color: #1e4d3e;">
            ${code}
          </div>
        </div>
        <div style="text-align: center; margin-top: 20px;">
          <a href="${directVerifyUrl}" target="_blank" style="display: block; width: 100%; box-sizing: border-box; text-decoration: none; padding: 14px 24px; border-radius: 12px; background-color: #1e4d3e; color: #ffffff; font-weight: 700; font-size: 14px; text-align: center; box-shadow: 0 4px 12px rgba(30, 77, 62, 0.25);">
            Hesabımı Doğrula &rarr;
          </a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
        &copy; 2026 MapsBridge Inc. Akıllı Seyahat &amp; Rota Platformu. Tüm hakları saklıdır.
      </td>
    </tr>
  </table>
</body>
</html>`;
}
