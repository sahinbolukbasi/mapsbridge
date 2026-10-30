"use client";
import { useEffect } from "react";
import { NotFoundView } from "./components/not-found-view";
export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring if needed
    console.error("MapsBridge Render Error:", error);
  }, [error]);
  return (
    <NotFoundView
      isError={true}
      errorMessage={error?.message || "Beklenmedik bir hata oluştu. Lütfen tekrar deneyin."}
      onRetry={reset}
    />
  );
}
