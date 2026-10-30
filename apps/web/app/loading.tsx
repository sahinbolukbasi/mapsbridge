import { LoadingState } from "./components/ui";
// Suspense fallback'i sayfanın statik HTML'ine de yazılır: <main> çizmez (tek main PageShell'de, AC-34).
export default function Loading() {
  return <LoadingState />;
}
