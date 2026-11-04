"use client";
import Home from "../home-client";
import { Alert } from "../components/ui";
import "./en.css";

export default function EnglishHome() {
  return (
    <>
      <div className="en-notice-bar">
        <Alert tone="info" title="English version is in beta">
          Only this page is fully translated for now. Menu links and inner pages currently continue
          in Turkish while we finish the full English version.
        </Alert>
      </div>
      <Home />
    </>
  );
}
