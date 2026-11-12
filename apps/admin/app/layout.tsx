import React from "react";
import "./styles/admin.css";
import { AdminAuthProvider } from "./lib/auth-context";

export const metadata = {
  title: "MapsBridge Central Admin — Subdomain Control",
  description: "İzole yönetim paneli: Polar.sh, Bedrock AgentCore, Kullanıcı ve Telemetri Yönetimi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" data-theme="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}

