"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function GeziAsistaniRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = searchParams.toString();
    router.replace(params ? `/travel-assistant/?${params}` : "/travel-assistant/");
  }, [router, searchParams]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0f1d",
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 40, color: "#22c55e", animation: "pulse 1.4s ease-in-out infinite" }}
      >
        neurology
      </span>
      <style>{`@keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.3;} }`}</style>
    </div>
  );
}
