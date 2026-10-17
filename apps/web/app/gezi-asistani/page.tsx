"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function GeziAsistaniPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = searchParams.toString();
    router.replace(params ? `/ai-asistan/?${params}` : "/ai-asistan/");
  }, [router, searchParams]);

  return null;
}
