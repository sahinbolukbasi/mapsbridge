"use client";
// Alan verisi (design §8.2 "Veri yükleme"): yalnızca aktif alanın GET uçları çekilir; yetkisi
// olmayanlar hiç çağrılmaz. Sekme görünür, dialog/mutasyon yokken 60 sn'de bir yenilenir.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { useToast } from "../../components/ui";
import type { UiError } from "../../components/ui/logic/http-error";
import { adminRequest, type AdminRequestOptions } from "../../lib/admin/client";
import type { EndpointId } from "../../lib/admin/endpoints";
import { toAdminError } from "../../lib/admin/errors";
import { canRun } from "../../lib/admin/rbac";
import type { AdminResponse, AdminSession } from "../../lib/admin/types";

export const REFRESH_MS = 60_000;

export type AreaStatus = { refreshing: boolean; updatedAt: number | null };

type AdminContextValue = {
  session: AdminSession;
  /** PageHeader "Yenile" her basışta artar; bağlı tüm alanlar yeniden çeker. */
  refreshSignal: number;
  /** >0 iken otomatik yenileme bekler (açık dialog, süren mutasyon). */
  holds: MutableRefObject<number>;
  reportStatus: (status: AreaStatus) => void;
};

export const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin: AdminContext yok (AdminClient altında kullanın)");
  return ctx;
}

/** Dialog açıkken otomatik yenilemeyi bekletir. */
export function useRefreshHold(active: boolean): void {
  const { holds } = useAdmin();
  useEffect(() => {
    if (!active) return;
    holds.current++;
    return () => {
      holds.current--;
    };
  }, [active, holds]);
}

export const FORBIDDEN_UI: UiError = {
  kind: "forbidden",
  title: "Yetkiniz yok",
  message: "Bu bölüm için yetkiniz bulunmuyor.",
  retryable: false,
  status: 403,
};

type Data<Ids extends readonly EndpointId[]> = Partial<{ [K in Ids[number]]: AdminResponse<K> }>;
type Errors<Ids extends readonly EndpointId[]> = Partial<Record<Ids[number], UiError>>;

export type AreaData<Ids extends readonly EndpointId[]> = {
  data: Data<Ids>;
  errors: Errors<Ids>;
  /** İlk yükleme sürüyor (henüz hiç veri yok). */
  loading: boolean;
  refreshing: boolean;
  updatedAt: number | null;
  reload: () => void;
};

export function useAreaData<const Ids extends readonly EndpointId[]>(
  ids: Ids,
  options: Partial<Record<Ids[number], AdminRequestOptions>> = {},
): AreaData<Ids> {
  const { session, refreshSignal, holds, reportStatus } = useAdmin();
  const [data, setData] = useState<Data<Ids>>({});
  const [errors, setErrors] = useState<Errors<Ids>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const inFlight = useRef(false);
  const key = ids.join(",");
  const optionsKey = JSON.stringify(options);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    const list = key.split(",") as Ids[number][];
    const opts = JSON.parse(optionsKey) as Partial<Record<Ids[number], AdminRequestOptions>>;
    const nextData: Data<Ids> = {};
    const nextErrors: Errors<Ids> = {};
    await Promise.all(
      list.map(async (id) => {
        if (!canRun(session, id)) {
          nextErrors[id] = FORBIDDEN_UI;
          return;
        }
        try {
          (nextData as Record<string, unknown>)[id] = await adminRequest(id, opts[id]);
        } catch (err) {
          nextErrors[id] = toAdminError(err, { endpointId: id });
        }
      }),
    );
    // Kısmi hata: başarılı uçların verisi güncellenir, hatalı uçta önceki veri korunur.
    setData((prev) => ({ ...prev, ...nextData }));
    setErrors(nextErrors);
    setUpdatedAt(Date.now());
    setLoading(false);
    setRefreshing(false);
    inFlight.current = false;
  }, [key, optionsKey, session]);

  useEffect(() => {
    void load();
  }, [load, refreshSignal]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || holds.current > 0) return;
      void load();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load, holds]);

  useEffect(() => {
    reportStatus({ refreshing, updatedAt });
  }, [refreshing, updatedAt, reportStatus]);

  return { data, errors, loading, refreshing, updatedAt, reload: () => void load() };
}

/** Mutasyon hatası: dialog içindeki Alert bu mesajı gösterir (dialog açık kalır). */
export class AdminActionError extends Error {
  ui: UiError;
  constructor(ui: UiError) {
    super(`${ui.title}. ${ui.message}`);
    this.ui = ui;
  }
}

/** Mutasyon: süresince otomatik yenileme bekler; başarıda Toast + `after` (genelde reload). */
export function useAdminMutation() {
  const { holds } = useAdmin();
  const toast = useToast();
  return useCallback(
    async function run<Id extends EndpointId>(
      id: Id,
      opts: AdminRequestOptions,
      { success, after }: { success?: string; after?: (res: AdminResponse<Id>) => void } = {},
    ): Promise<AdminResponse<Id>> {
      holds.current++;
      try {
        const res = await adminRequest(id, opts);
        if (success) toast.show({ tone: "success", message: success });
        after?.(res);
        return res;
      } catch (err) {
        throw new AdminActionError(toAdminError(err, { endpointId: id }));
      } finally {
        holds.current--;
      }
    },
    [holds, toast],
  );
}
