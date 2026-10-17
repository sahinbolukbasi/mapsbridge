"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function HaritalarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = searchParams.toString();
    router.replace(params ? `/desk/?${params}` : "/desk/");
  }, [router, searchParams]);

  return null;
}
