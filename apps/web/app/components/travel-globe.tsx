"use client";

import { useEffect, useRef, useState } from "react";
import { SavedAddress } from "../desk/page";

interface TravelGlobeProps {
  addresses: SavedAddress[];
}

export function TravelGlobe({ addresses }: TravelGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRotating, setIsRotating] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{
    label: string;
    status: string;
    group: string;
  } | null>(null);

  const rotRef = useRef({ yaw: 0.8, pitch: 0.35 });
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // Sadece kullanıcının ziyaret ettiği yerler (Gittiğim Yerler)
  const visitedOnly = addresses.filter((a) => a.visited);
  const globePoints = visitedOnly.map((a) => ({
    lat: a.lat,
    lng: a.lng,
    label: a.label,
    visited: true,
    group: a.group || "Genel",
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;

    function render() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * (isExpanded ? 0.44 : 0.42);

      time += 1;
      if (isRotating && !isDraggingRef.current) {
        rotRef.current.yaw += 0.005;
      }

      const yaw = rotRef.current.yaw;
      const pitch = rotRef.current.pitch;

      // 1. Atmosfer Halesi (Aura)
      const auraGrad = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.3);
      auraGrad.addColorStop(0, "rgba(56, 189, 248, 0.25)");
      auraGrad.addColorStop(0.5, "rgba(37, 99, 235, 0.12)");
      auraGrad.addColorStop(1, "rgba(37, 99, 235, 0)");
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // 2. Dünya Küresi (Gövde)
      const sphereGrad = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
      const isDark = isExpanded;
      if (isDark) {
        sphereGrad.addColorStop(0, "#172554");
        sphereGrad.addColorStop(0.65, "#0b1329");
        sphereGrad.addColorStop(1, "#040711");
      } else {
        sphereGrad.addColorStop(0, "#bae6fd");
        sphereGrad.addColorStop(0.6, "#0284c7");
        sphereGrad.addColorStop(1, "#0369a1");
      }

      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = sphereGrad;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.45)" : "rgba(2, 132, 199, 0.5)";
      ctx.stroke();

      // Projeksiyon Dönüşüm Fonksiyonu (Lat/Lng -> 3D Küre -> 2D Ekran)
      function project(latDeg: number, lngDeg: number, altitude = 0) {
        const phi = (latDeg * Math.PI) / 180;
        const lam = (lngDeg * Math.PI) / 180 + yaw;
        const rad = R * (1 + altitude);

        const x = Math.cos(phi) * Math.sin(lam);
        const y = Math.sin(phi);
        const z = Math.cos(phi) * Math.cos(lam);

        const y2 = y * Math.cos(pitch) - z * Math.sin(pitch);
        const z2 = y * Math.sin(pitch) + z * Math.cos(pitch);

        return {
          px: cx + x * rad,
          py: cy - y2 * rad,
          visible: z2 > -0.1,
          depth: z2,
        };
      }

      // 3. Meridyen ve Paralel Çizgileri
      ctx.lineWidth = 0.75;
      ctx.strokeStyle = isDark ? "rgba(148, 163, 184, 0.18)" : "rgba(255, 255, 255, 0.35)";

      [-60, -30, 0, 30, 60].forEach((lat) => {
        ctx.beginPath();
        let started = false;
        for (let lng = -180; lng <= 180; lng += 8) {
          const pt = project(lat, lng);
          if (pt.visible) {
            if (!started) {
              ctx.moveTo(pt.px, pt.py);
              started = true;
            } else {
              ctx.lineTo(pt.px, pt.py);
            }
          } else {
            started = false;
          }
        }
        ctx.stroke();
      });

      for (let lng = -180; lng < 180; lng += 30) {
        ctx.beginPath();
        let started = false;
        for (let lat = -80; lat <= 80; lat += 5) {
          const pt = project(lat, lng);
          if (pt.visible) {
            if (!started) {
              ctx.moveTo(pt.px, pt.py);
              started = true;
            } else {
              ctx.lineTo(pt.px, pt.py);
            }
          } else {
            started = false;
          }
        }
        ctx.stroke();
      }

      // 4. Kıta Hatları
      const continents = [
        [
          [36, -5],
          [43, -9],
          [50, -5],
          [58, 5],
          [65, 25],
          [70, 40],
          [60, 60],
          [45, 80],
          [35, 120],
          [20, 110],
          [10, 100],
          [15, 80],
          [25, 60],
          [30, 45],
          [38, 28],
          [36, 15],
          [36, -5],
        ],
        [
          [36, -5],
          [35, 12],
          [30, 32],
          [12, 51],
          [5, 48],
          [-12, 40],
          [-34, 18],
          [-34, 25],
          [-15, 12],
          [4, 9],
          [15, -17],
          [32, -8],
          [36, -5],
        ],
        [
          [25, -80],
          [35, -75],
          [45, -65],
          [60, -65],
          [70, -130],
          [55, -165],
          [35, -120],
          [20, -105],
          [15, -90],
          [25, -80],
        ],
        [
          [10, -75],
          [5, -50],
          [-10, -35],
          [-25, -48],
          [-55, -68],
          [-40, -73],
          [-15, -75],
          [0, -80],
          [10, -75],
        ],
      ];

      ctx.fillStyle = isDark ? "rgba(56, 189, 248, 0.08)" : "rgba(255, 255, 255, 0.22)";
      ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.35)" : "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 1.2;

      continents.forEach((poly) => {
        ctx.beginPath();
        let first = true;
        let anyVisible = false;
        poly.forEach(([lat, lng]) => {
          const pt = project(lat, lng);
          if (pt.visible) {
            anyVisible = true;
            if (first) {
              ctx.moveTo(pt.px, pt.py);
              first = false;
            } else {
              ctx.lineTo(pt.px, pt.py);
            }
          }
        });
        if (anyVisible) {
          ctx.stroke();
          ctx.fill();
        }
      });

      // =========================================================
      // 5. ETKİLEYİCİ ROTA ŞOVU: Uçuş Arkları & Işık Hüzmeleri
      // =========================================================
      if (globePoints.length >= 2) {
        for (let i = 0; i < globePoints.length - 1; i++) {
          const p1 = globePoints[i];
          const p2 = globePoints[i + 1];

          // Yay çizgisi (20 ara nokta)
          ctx.beginPath();
          let arcStarted = false;
          const arcPoints: { px: number; py: number; visible: boolean }[] = [];

          for (let step = 0; step <= 20; step++) {
            const frac = step / 20;
            const curLat = p1.lat + (p2.lat - p1.lat) * frac;
            const curLng = p1.lng + (p2.lng - p1.lng) * frac;
            // Eğri yay yüksekliği: sin(frac * PI)
            const alt = Math.sin(frac * Math.PI) * 0.16;
            const proj = project(curLat, curLng, alt);
            arcPoints.push(proj);

            if (proj.visible) {
              if (!arcStarted) {
                ctx.moveTo(proj.px, proj.py);
                arcStarted = true;
              } else {
                ctx.lineTo(proj.px, proj.py);
              }
            } else {
              arcStarted = false;
            }
          }

          // Işıltılı ark çizgisi
          ctx.strokeStyle = "rgba(56, 189, 248, 0.65)";
          ctx.lineWidth = isExpanded ? 2.2 : 1.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Akan Işık Fotonu (Flowing Light Particle)
          const particleT = (time * 0.02 + i * 0.3) % 1;
          const particleStep = Math.floor(particleT * 20);
          const activePt = arcPoints[particleStep];
          if (activePt && activePt.visible) {
            ctx.beginPath();
            ctx.arc(activePt.px, activePt.py, isExpanded ? 5.5 : 4, 0, Math.PI * 2);
            ctx.fillStyle = "#38bdf8";
            ctx.shadowColor = "#38bdf8";
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }

      // 6. Lokasyon Noktaları & Parlayan Pinler
      globePoints.forEach((pt, idx) => {
        const prj = project(pt.lat, pt.lng);
        if (!prj.visible) return;

        const isVis = pt.visited;
        const color = isVis ? "#10b981" : "#38bdf8";
        const pulse = Math.sin(time * 0.06 + idx * 0.8) * 3;

        // Dış parıltı dalgası
        ctx.beginPath();
        ctx.arc(prj.px, prj.py, (isExpanded ? 8 : 6) + pulse, 0, Math.PI * 2);
        ctx.fillStyle = isVis ? "rgba(16, 185, 129, 0.25)" : "rgba(56, 189, 248, 0.25)";
        ctx.fill();

        // İç katı pin noktası
        ctx.beginPath();
        ctx.arc(prj.px, prj.py, isExpanded ? 5 : 3.8, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();

        // Pin İsim Etiketi
        if (prj.depth > 0.35) {
          ctx.font = isExpanded ? "bold 12px sans-serif" : "bold 9.5px sans-serif";
          ctx.fillStyle = isDark ? "#f8fafc" : "#0f172a";
          ctx.fillText(pt.label.split(" ")[0], prj.px + 8, prj.py + 4);
        }
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    }

    render();

    return () => cancelAnimationFrame(animId);
  }, [isRotating, addresses, isExpanded]);

  function handleMouseDown(e: React.MouseEvent) {
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDraggingRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * (isExpanded ? 0.44 : 0.42);

      let found = null;
      for (const pt of globePoints) {
        const phi = (pt.lat * Math.PI) / 180;
        const lam = (pt.lng * Math.PI) / 180 + rotRef.current.yaw;
        const x = Math.cos(phi) * Math.sin(lam);
        const y = Math.sin(phi);
        const z = Math.cos(phi) * Math.cos(lam);
        const y2 = y * Math.cos(rotRef.current.pitch) - z * Math.sin(rotRef.current.pitch);
        const z2 = y * Math.sin(rotRef.current.pitch) + z * Math.cos(rotRef.current.pitch);
        if (z2 > 0) {
          const px = cx + x * R;
          const py = cy - y2 * R;
          const dist = Math.hypot(mx - px, my - py);
          if (dist < 16) {
            found = {
              label: pt.label,
              status: pt.visited ? "✓ Ziyaret Edildi" : "○ Planlanan Rota",
              group: pt.group,
            };
            break;
          }
        }
      }
      setHoveredPoint(found);
      return;
    }

    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };

    rotRef.current.yaw += dx * 0.008;
    rotRef.current.pitch = Math.max(-1.1, Math.min(1.1, rotRef.current.pitch + dy * 0.008));
  }

  function handleMouseUp() {
    isDraggingRef.current = false;
  }

  return (
    <>
      <div className={`globe-card ${isExpanded ? "hidden-placeholder" : ""}`}>
        <div className="globe-header">
          <div>
            <span className="globe-eyebrow">SEYAHAT İZİM</span>
            <h3 className="globe-title">Gittiğim Yerler</h3>
            <p className="globe-subtitle">
              {hoveredPoint
                ? `${hoveredPoint.label} · ${hoveredPoint.status} (${hoveredPoint.group})`
                : "Dünya haritanızda ayak bastığınız tüm duraklar. Büyütmek veya döndürmek için tıklayın."}
            </p>
          </div>
          <div className="globe-ctrl-group">
            <button
              type="button"
              className="globe-ctrl-btn expand-btn"
              onClick={() => setIsExpanded(true)}
              title="Dünyayı Büyüt ve Rota Işık Şovunu İzle"
            >
              ⛶ Büyüt & Şov
            </button>
            <button
              type="button"
              className="globe-ctrl-btn"
              onClick={() => setIsRotating(!isRotating)}
            >
              {isRotating ? "⏸ Durdur" : "▶ Döndür"}
            </button>
          </div>
        </div>

        <div
          className="globe-canvas-wrap"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={() => !isExpanded && setIsExpanded(true)}
          style={{ cursor: isExpanded ? "grab" : "pointer" }}
          title="Büyütmek için tıklayın"
        >
          <canvas ref={canvasRef} className="globe-canvas" />
          <div className="globe-click-hint">⛶ Tıklayarak Büyüt</div>
        </div>

        <div className="globe-legend-row">
          <span className="legend-item">
            <span className="legend-dot visited" /> Ziyaret Ettiğim Yerler ({visitedOnly.length})
          </span>
          {visitedOnly.length >= 2 && (
            <span className="legend-item">
              <span className="legend-line-arc" /> Işıltılı Rota Bağlantıları
            </span>
          )}
        </div>
      </div>

      {/* BÜYÜTÜLMÜŞ TAM EKRAN SAHNE & ROTA ŞOVU */}
      {isExpanded && (
        <div className="globe-expanded-overlay" onClick={() => setIsExpanded(false)}>
          <div
            className="globe-expanded-stage"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="expanded-stage-head">
              <div className="stage-title-wrap">
                <span className="stage-badge">✨ 3D KÜRE SEYAHAT ŞOVU</span>
                <h2>Dünya Üzerindeki Seyahat Rotanız</h2>
                <p>
                  Tamamladığınız duraklar arasında parlayan ışık arkları akıyor. Döndürmek için
                  sürükleyebilirsiniz.
                </p>
              </div>
              <div className="stage-actions">
                <button
                  type="button"
                  className="stage-ctrl-btn"
                  onClick={() => setIsRotating(!isRotating)}
                >
                  {isRotating ? "⏸ Döndürmeyi Durdur" : "▶ Otomatik Döndür"}
                </button>
                <button
                  type="button"
                  className="stage-close-btn"
                  onClick={() => setIsExpanded(false)}
                  title="Küçült ve Kapat"
                >
                  ✕ Küçült
                </button>
              </div>
            </div>

            <div
              className="expanded-canvas-wrapper"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <canvas ref={canvasRef} className="expanded-canvas" />
            </div>

            <div className="expanded-stage-footer">
              <div className="stage-stops-sequence">
                <span className="sequence-label">🚀 Gezi Durakları:</span>
                {visitedOnly.map((st, idx) => (
                  <span key={st.id} className="sequence-chip">
                    #{idx + 1} {st.label}
                    {idx < visitedOnly.length - 1 && <span className="arrow">➔</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
