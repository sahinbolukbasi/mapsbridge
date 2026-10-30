export default function MapsLoading() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        background: "#0d1117",
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 40, color: "#22c55e", animation: "ui-pulse 1.4s ease-in-out infinite" }}
      >
        map
      </span>
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Loading map…</div>
    </div>
  );
}
