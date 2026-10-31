export default function TravelAssistantLoading() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        background: "var(--color-neutral-900)",
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 40, color: "#22c55e", animation: "ui-pulse 1.4s ease-in-out infinite" }}
      >
        neurology
      </span>
      <div
        style={{
          color: "color-mix(in srgb, var(--color-on-primary) 40%, transparent)",
          fontSize: 14,
        }}
      >
        Loading assistant…
      </div>
    </div>
  );
}
