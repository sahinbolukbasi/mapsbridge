"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api-client";
import { PageHeader, PageShell } from "../components/ui";

type Blog = {
  blogId: string;
  title: string;
  content: string;
  createdAt: string;
  PK?: string;
  SK?: string;
};

export default function ArticlesPage() {
  const [rows, setRows] = useState<Blog[]>([]);
  const [selected, setSelected] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      // Admin panelindeki content endpoint'inden veri çekiyoruz
      const response = await apiFetch<{ content: Blog[] }>("/admin/content", { skipAuth: true });
      setRows(response.content.filter((item) => item.PK?.startsWith("BLOG#")));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Yazılar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-bg)",
      }}
    >
      <PageShell layout="landing" header={<PageHeader variant="hidden" />}>
        <div
          className="support-page"
          style={{ maxWidth: "1000px", margin: "2rem auto", padding: "0 1.5rem", width: "100%" }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}
          >
            <Link
              href="/"
              style={{
                color: "var(--color-success)",
                textDecoration: "none",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                arrow_back
              </span>
              Ana Sayfaya Dön
            </Link>
          </div>

          <p
            style={{
              fontSize: "2rem",
              fontWeight: 800,
              textWrap: "balance",
              color: "var(--color-primary)",
              marginTop: "0.67em",
              marginBottom: "0.5rem",
            }}
          >
            MapsBridge Gezgin Yazıları &amp; Rehberler
          </p>
          <p style={{ color: "#64748b", marginBottom: "2rem" }}>
            Keşif rotaları, seyahat tüyoları ve topluluk hikayeleri.
          </p>

          {error && (
            <p
              role="alert"
              className="error"
              style={{
                padding: "1rem",
                borderRadius: "12px",
                background: "var(--color-danger-bg)",
                color: "var(--color-danger)",
                marginBottom: "1.5rem",
              }}
            >
              {error}
              <button
                onClick={() => void load()}
                style={{
                  marginLeft: "1rem",
                  fontWeight: 700,
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Tekrar dene
              </button>
            </p>
          )}

          {selected ? (
            <article
              className="support-card"
              style={{
                background: "#ffffff",
                borderRadius: "16px",
                padding: "2rem",
                border: "1px solid rgba(226, 232, 240, 0.8)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
              }}
            >
              <button
                onClick={() => setSelected(null)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  color: "#10b981",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  marginBottom: "1.5rem",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  arrow_back
                </span>
                Tüm yazılara dön
              </button>
              <h2
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 800,
                  marginBottom: "1rem",
                  color: "#013628",
                }}
              >
                {selected.title}
              </h2>
              <div
                className="public-post"
                style={{ lineHeight: 1.7, color: "#334155", fontSize: "15px" }}
              >
                {selected.content}
              </div>
            </article>
          ) : loading ? (
            <p style={{ color: "#64748b" }}>Yükleniyor…</p>
          ) : !rows.length ? (
            <div
              style={{
                textAlign: "center",
                padding: "4rem 2rem",
                background: "#ffffff",
                borderRadius: "16px",
                border: "1px solid rgba(226, 232, 240, 0.8)",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "48px", color: "#10b981", marginBottom: "1rem" }}
              >
                article
              </span>
              <p style={{ color: "#64748b", fontWeight: 600 }}>
                Henüz yayımlanmış yazı bulunmuyor.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "1.25rem" }}>
              {rows.map((row) => (
                <article
                  key={row.blogId || row.SK}
                  className="support-card"
                  style={{
                    background: "#ffffff",
                    borderRadius: "16px",
                    padding: "1.5rem",
                    border: "1px solid rgba(226, 232, 240, 0.8)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                  }}
                >
                  <h2
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      marginBottom: "0.5rem",
                      color: "#013628",
                    }}
                  >
                    {row.title}
                  </h2>
                  <p
                    style={{
                      color: "#64748b",
                      marginBottom: "1rem",
                      lineHeight: 1.6,
                      fontSize: "14px",
                    }}
                  >
                    {row.content.substring(0, 200)}...
                  </p>
                  <button
                    style={{
                      background: "#10b981",
                      color: "#ffffff",
                      border: "none",
                      padding: "0.5rem 1rem",
                      borderRadius: "9999px",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                    onClick={async () => {
                      setError("");
                      try {
                        // Admin panelindeki blog detay endpoint'ini kullanıyoruz
                        const id = row.blogId || (row.SK ? row.SK.split("#")[1] : undefined);
                        if (id) {
                          const detail = await apiFetch<Blog>(
                            `/admin/content/blog/${encodeURIComponent(id)}`,
                            { skipAuth: true },
                          );
                          setSelected(detail);
                        }
                      } catch (err: unknown) {
                        setError(err instanceof Error ? err.message : String(err));
                      }
                    }}
                  >
                    Devamını oku
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </PageShell>
    </div>
  );
}
