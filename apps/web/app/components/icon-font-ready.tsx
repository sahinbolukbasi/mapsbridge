"use client";

import { useEffect } from "react";

// Never expose ligature names while the font is delayed, unavailable or offline.
export function IconFontReady() {
  useEffect(() => {
    let active = true;
    document.fonts
      .load('20px "Material Symbols Outlined"')
      .then((faces) => {
        if (active && faces.length > 0 && faces.every((face) => face.status === "loaded")) {
          document.documentElement.dataset.iconsReady = "true";
        }
      })
      .catch(() => {
        /* Keep the reserved icon space; labels remain usable. */
      });
    return () => {
      active = false;
    };
  }, []);
  return null;
}
