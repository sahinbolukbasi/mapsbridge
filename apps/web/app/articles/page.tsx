"use client";
// /articles/ (design §5.2): yayımlanmış yazılar Card listesi + okuma görünümü. Veri akışı
// değişmedi (GET /admin/content, BLOG# süzgeci; ayrıntı GET /admin/content/blog/{id}).
// Yazı kayıtlarında görsel alanı yok (marketplace/admin şeması): Media yalnızca görsel varsa
// anlamlı olacağından render edilmez (I10).
import { useEffect, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  PageHeader,
  PageShell,
  Section,
  toUiError,
  type UiError,
} from "../components/ui";
import { apiFetch } from "../lib/api-client";
import { useLocale } from "../lib/locale-context";
import "./articles.css";

type Blog = {
  blogId: string;
  title: string;
  content: string;
  createdAt: string;
  PK?: string;
  SK?: string;
};

const EXCERPT = 200;
const excerpt = (text: string) =>
  text.length > EXCERPT ? `${text.slice(0, EXCERPT).trimEnd()}…` : text;
const blogIdOf = (row: Blog) => row.blogId || (row.SK ? row.SK.split("#")[1] : undefined);

export default function ArticlesPage() {
  const { t, locale } = useLocale();
  const [rows, setRows] = useState<Blog[]>([]);
  const [selected, setSelected] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<UiError | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ content: Blog[] }>("/admin/content", { skipAuth: true });
      setRows(response.content.filter((item) => item.PK?.startsWith("BLOG#")));
    } catch (err: unknown) {
      setError(toUiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const open = async (row: Blog) => {
    const id = blogIdOf(row);
    if (!id) return;
    setError(null);
    setOpening(id);
    try {
      setSelected(
        await apiFetch<Blog>(`/admin/content/blog/${encodeURIComponent(id)}`, { skipAuth: true }),
      );
    } catch (err: unknown) {
      setError(toUiError(err));
    } finally {
      setOpening(null);
    }
  };

  const date = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? null
      : d.toLocaleDateString(locale === "en" ? "en-GB" : "tr-TR", { dateStyle: "long" });
  };

  return (
    <PageShell
      className="articles"
      header={
        <PageHeader
          description={t("articles.lead", "Seyahat rehberleri ve MapsBridge ekibinin yazıları.")}
          breadcrumb={[
            { label: t("ui.breadcrumb.home", "Ana sayfa"), href: "/" },
            { label: t("articles.breadcrumb", "Yazılar") },
          ]}
        />
      }
    >
      {error && <ErrorState error={error} onRetry={() => void load()} />}
      {selected ? (
        <Card as="article" className="articles-reader">
          <div className="articles-reader__back">
            <Button
              variant="ghost"
              size="sm"
              iconStart={<Icon name="arrow" size={16} className="articles-back-icon" />}
              onClick={() => setSelected(null)}
            >
              {t("articles.back", "Tüm yazılar")}
            </Button>
          </div>
          <h2 className="articles-reader__title">{selected.title}</h2>
          {date(selected.createdAt) && (
            <p className="articles-meta">
              <time dateTime={selected.createdAt}>{date(selected.createdAt)}</time>
            </p>
          )}
          <div className="articles-reader__body">{selected.content}</div>
        </Card>
      ) : loading ? (
        <LoadingState label={t("articles.loading", "Yazılar yükleniyor…")} />
      ) : !rows.length ? (
        !error && (
          <EmptyState
            icon="inbox"
            title={t("articles.empty", "Henüz yayımlanmış yazı yok.")}
            description={t("articles.emptyBody", "Yeni yazılar yayımlandığında burada listelenir.")}
          />
        )
      ) : (
        <Section title={t("articles.listTitle", "Tüm yazılar")}>
          <ul className="articles-list">
            {rows.map((row) => {
              const id = blogIdOf(row) ?? row.title;
              return (
                <Card as="li" key={id} className="articles-list__item">
                  <h3 className="articles-list__title">{row.title}</h3>
                  {date(row.createdAt) && (
                    <p className="articles-meta">
                      <time dateTime={row.createdAt}>{date(row.createdAt)}</time>
                    </p>
                  )}
                  <p className="articles-list__excerpt">{excerpt(row.content)}</p>
                  <div>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={opening === id}
                      onClick={() => void open(row)}
                      aria-label={`${t("articles.read", "Devamını oku")}: ${row.title}`}
                    >
                      {t("articles.read", "Devamını oku")}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </ul>
        </Section>
      )}
    </PageShell>
  );
}
