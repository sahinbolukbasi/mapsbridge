"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function UHubPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/checkout/");
  }, [router]);
  return <p role="status">Yönlendiriliyor...</p>;
}
