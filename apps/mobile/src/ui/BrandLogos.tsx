import React from "react";
import Svg, { Path } from "react-native-svg";
import { tokens } from "../theme";

// Google + Apple marka logoları (G17). Web'deki GoogleLogo/AppleLogo bileşenleriyle aynı
// path'ler. Renk literal'i YAZILMAZ: Google renkleri yalnız tokens.thirdParty'den gelir
// (design-system §Renk "Google renkleri yalnızca GoogleLogo bileşenindedir"), Apple logosu
// metin rengini (tokens.color) alır. Dekoratif: etiket metinle değil buton etrafındaki
// erişilebilir adla verilir, bu yüzden svg aria-hidden.

export function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        fill={tokens.thirdParty["google-blue"]}
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <Path
        fill={tokens.thirdParty["google-green"]}
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <Path
        fill={tokens.thirdParty["google-yellow"]}
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <Path
        fill={tokens.thirdParty["google-red"]}
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </Svg>
  );
}

export function AppleLogo({
  size = 18,
  color = tokens.color.text,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 170 170" accessibilityElementsHidden>
      <Path
        fill={color}
        d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.69-7.85-12-14.42-6-9.13-10.74-19.55-14.22-31.26-3.48-11.71-5.22-22.95-5.22-33.72 0-14.13 3.59-26.06 10.76-35.79 7.18-9.73 16.2-14.65 27.08-14.77 5.22 0 10.79 1.39 16.71 4.17 5.92 2.78 9.78 4.22 11.58 4.31 1.41 0 5.48-1.57 12.21-4.71 6.74-3.14 12.63-4.52 17.68-4.14 13.48.87 23.97 5.86 31.47 14.97-12.06 7.28-17.98 17.26-17.76 29.95.22 9.89 3.96 18.06 11.22 24.51 7.26 6.45 15.82 10.12 25.68 11.01-2.17 6.74-4.78 13.32-7.84 19.74zM119.22 31.81c0-7.39 2.66-14.39 7.99-20.99 5.33-6.61 11.85-10.55 19.57-11.82.22 1.3.33 2.39.33 3.26 0 7.39-2.83 14.45-8.49 21.18-5.65 6.74-12.28 10.59-19.89 11.56-.11-1.09-.17-2.17-.17-3.19z"
      />
    </Svg>
  );
}
