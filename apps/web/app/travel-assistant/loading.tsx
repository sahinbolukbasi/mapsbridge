// Rota segmenti yüklenirken (Next loading.tsx): Kartograf LoadingState (FEAT-013).
import { LoadingState } from "../components/ui";
import "./studio.css";

export default function TravelAssistantLoading() {
  return (
    <div className="as-studio-loading">
      <LoadingState />
    </div>
  );
}
