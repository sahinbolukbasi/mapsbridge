"use client";

import React, { useEffect, useState, createContext, useContext } from "react";

export type MobilePlatform = "ios" | "android" | "web";

interface MobilePlatformContextType {
  platform: MobilePlatform;
  setPlatform: (p: MobilePlatform) => void;
  isNative: boolean;
}

const MobilePlatformContext = createContext<MobilePlatformContextType>({
  platform: "ios",
  setPlatform: () => {},
  isNative: false,
});

export function useMobilePlatform() {
  return useContext(MobilePlatformContext);
}

export function MobilePlatformProvider({ children }: { children: React.ReactNode }) {
  const [platform, setPlatformState] = useState<MobilePlatform>("ios");
  const [isNative, setIsNative] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = localStorage.getItem("mapsbridge.mobile_platform") as MobilePlatform | null;
    let initial: MobilePlatform = "ios";

    if (saved === "ios" || saved === "android") {
      initial = saved;
    } else {
      const ua = navigator.userAgent || "";
      if (/Android/i.test(ua)) {
        initial = "android";
      } else {
        initial = "ios";
      }
    }

    setPlatformState(initial);
    setIsNative(false);
    document.documentElement.dataset.platform = initial;
  }, []);

  const setPlatform = (p: MobilePlatform) => {
    setPlatformState(p);
    if (typeof window !== "undefined") {
      localStorage.setItem("mapsbridge.mobile_platform", p);
      document.documentElement.dataset.platform = p;
    }
  };

  return (
    <MobilePlatformContext.Provider value={{ platform, setPlatform, isNative }}>
      {children}
    </MobilePlatformContext.Provider>
  );
}
