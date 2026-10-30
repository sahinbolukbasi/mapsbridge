"use client";
// Tek kanonik yönetim paneli (design §8.2). Oturum → RBAC (GET /admin/session) → alan
// yönlendirme (?alan=, history push; alt alan ?sekme=, replace). useSearchParams yok: prerender
// HTML'i kapı/yükleniyor durumunu içerir (tek main + tek h1, AC-34).
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import {
  Button,
  ErrorState,
  LoadingState,
  PageHeader,
  PageShell,
  useToast,
  useUrlParam,
} from "../../components/ui";
import type { UiError } from "../../components/ui/logic/http-error";
import { adminRequest } from "../../lib/admin/client";
import type { AdminAreaId } from "../../lib/admin/endpoints";
import { toAdminError } from "../../lib/admin/errors";
import { visibleAreas } from "../../lib/admin/rbac";
import type { AdminSession } from "../../lib/admin/types";
import { getStoredSession } from "../../lib/cognito";
import { AdminNav, AREA_LABELS } from "./admin-nav";
import { AiArea } from "./areas/ai";
import { AnalitikArea } from "./areas/analitik";
import { DestekArea } from "./areas/destek";
import { FinansArea } from "./areas/finans";
import { FiyatlandirmaArea } from "./areas/fiyatlandirma";
import { GecmisArea } from "./areas/gecmis";
import { GenelArea } from "./areas/genel";
import { IcerikArea } from "./areas/icerik";
import { KullanicilarArea } from "./areas/kullanicilar";
import { ModerasyonArea } from "./areas/moderasyon";
import { SistemArea } from "./areas/sistem";
import { formatTime } from "./format";
import { AdminContext, type AreaStatus } from "./use-area-data";
import "./admin.css";

const LOGIN_HREF = "/login/?next=/u/admin/";

const AREA_COMPONENTS: Record<AdminAreaId, () => JSX.Element> = {
  genel: GenelArea,
  kullanicilar: KullanicilarArea,
  moderasyon: ModerasyonArea,
  icerik: IcerikArea,
  destek: DestekArea,
  finans: FinansArea,
  fiyatlandirma: FiyatlandirmaArea,
  ai: AiArea,
  analitik: AnalitikArea,
  sistem: SistemArea,
  gecmis: GecmisArea,
};

type Access =
  | { state: "checking" }
  | { state: "anonymous" }
  | { state: "error"; error: UiError }
  | { state: "ready"; session: AdminSession };

export default function AdminClient() {
  const [access, setAccess] = useState<Access>({ state: "checking" });

  const check = useCallback(async () => {
    if (!getStoredSession()?.token) {
      setAccess({ state: "anonymous" });
      return;
    }
    setAccess({ state: "checking" });
    try {
      const { session } = await adminRequest("session");
      setAccess({ state: "ready", session });
    } catch (err) {
      setAccess({ state: "error", error: toAdminError(err, { endpointId: "session" }) });
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  if (access.state === "ready") return <AdminWorkspace session={access.session} />;

  return (
    <PageShell layout="form">
      <PageHeader
        titleText={access.state === "anonymous" ? "Yönetici erişimi gerekli" : "Yönetim"}
        description={
          access.state === "anonymous"
            ? "Yönetim paneline yalnızca yönetici, moderatör ve destek ekibi erişebilir."
            : undefined
        }
      />
      {access.state === "checking" && <LoadingState label="Yönetici oturumu doğrulanıyor…" />}
      {access.state === "anonymous" && (
        <div className="admin-gate">
          <p>Devam etmek için personel hesabınızla giriş yapın.</p>
          <Button href={LOGIN_HREF}>Giriş yap</Button>
        </div>
      )}
      {access.state === "error" && (
        <ErrorState
          error={access.error}
          onRetry={() => void check()}
          onRefresh={() => void check()}
        />
      )}
    </PageShell>
  );
}

function AdminWorkspace({ session }: { session: AdminSession }) {
  const toast = useToast();
  const areas = useMemo(() => visibleAreas(session), [session]);
  const [area, setArea] = useUrlParam<AdminAreaId>("alan", {
    allowed: areas,
    fallback: "genel",
    history: "push",
  });
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [status, setStatus] = useState<AreaStatus>({ refreshing: false, updatedAt: null });
  const holds = useRef(0);
  const warned = useRef(false);

  // Bilinmeyen/yetkisiz ?alan= Genel bakış'a düşer (useUrlParam) ve bir kez uyarılır.
  useEffect(() => {
    if (warned.current) return;
    const requested = new URLSearchParams(window.location.search).get("alan");
    if (requested && !areas.includes(requested as AdminAreaId)) {
      warned.current = true;
      toast.show({ tone: "warning", message: "Bu bölüm için yetkiniz yok." });
    }
  }, [areas, toast]);

  const select = useCallback(
    (next: AdminAreaId) => {
      // Önceki alanın ?sekme= değeri yeni alana taşınmaz.
      const url = new URL(window.location.href);
      if (url.searchParams.has("sekme")) {
        url.searchParams.delete("sekme");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
      setStatus({ refreshing: false, updatedAt: null });
      setArea(next);
    },
    [setArea],
  );

  const ctx = useMemo(
    () => ({ session, refreshSignal, holds, reportStatus: setStatus }),
    [session, refreshSignal],
  );
  const Area = AREA_COMPONENTS[area] ?? GenelArea;
  const label = AREA_LABELS[area] ?? AREA_LABELS.genel;

  return (
    <AdminContext.Provider value={ctx}>
      <PageShell
        layout="sidebar"
        className="admin-shell"
        header={
          <PageHeader
            titleText={label}
            breadcrumb={[{ label: "Yönetim", href: "/u/admin/" }, { label }]}
            description={
              <span role="status" className="admin-status">
                {status.refreshing
                  ? "Güncelleniyor…"
                  : `Son güncelleme: ${formatTime(status.updatedAt)}`}
              </span>
            }
            actions={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRefreshSignal((n) => n + 1)}
                loading={status.refreshing}
              >
                Yenile
              </Button>
            }
          />
        }
        sidebar={<AdminNav areas={areas} active={area} role={session.role} onSelect={select} />}
      >
        <Area key={area} />
      </PageShell>
    </AdminContext.Provider>
  );
}
