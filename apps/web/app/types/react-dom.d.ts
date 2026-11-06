// react-dom@19.0.0 kurulu ama @types/react-dom yok (yeni bağımlılık eklenmez). Yalnız kullanılan
// API'nin tipi: Leaflet popup'ına React içerik (components/trip/pin-popup.tsx, maps-client).
declare module "react-dom" {
  import type { ReactNode, ReactPortal } from "react";
  export function createPortal(
    children: ReactNode,
    container: Element | DocumentFragment,
    key?: string | null,
  ): ReactPortal;
}
