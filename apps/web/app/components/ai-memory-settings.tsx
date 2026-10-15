"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api-client";
import { getStoredSession } from "../lib/cognito";
import { preferenceChoices } from "../lib/ai/preferences";

interface MemoryView {
  enabled: boolean;
  preferences: Record<string, string | string[]>;
  memories: Array<{ id: string; text: string }>;
  deletion: { status: string };
}
const labels: Record<string, string> = {
  pace: "Gezi temposu",
  budget: "Bütçe",
  travelStyle: "Seyahat stili",
  interests: "İlgi alanları",
};
export function AIMemorySettings() {
  const [data, setData] = useState<MemoryView | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false),
    epoch = useRef(0);
  async function load() {
    const id = ++epoch.current,
      token = getStoredSession()?.token;
    try {
      const value = await apiFetch<MemoryView>("/ai/memory");
      if (epoch.current === id && getStoredSession()?.token === token) setData(value);
    } catch (e: any) {
      if (epoch.current === id) setMessage(e.message || "Hafıza bilgisi alınamadı.");
    }
  }
  useEffect(() => {
    void load();
    return () => {
      epoch.current++;
    };
  }, []);
  async function mutate(path: string, method: string, body?: unknown) {
    setBusy(true);
    setMessage("");
    try {
      await apiFetch(path, { method, body: JSON.stringify(body) });
      setMessage("Kaydedildi.");
      await load();
    } catch (e: any) {
      setMessage(e.message || "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }
  return (
    <section className="stitch-form-section" aria-labelledby="ai-memory-title">
      <h2 id="ai-memory-title">Hatırladıklarım</h2>
      <p>
        Yalnızca açıkça kalıcı tercih olarak belirttiğin bilgileri sonraki sohbetlerde
        kullanabilirim. Tek bir rota için verdiğin tempo veya enerji tercihi kalıcı hafızaya
        alınmaz. Konuşmaların model eğitimi için kullanılmaz.
      </p>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {!data ? (
        <button type="button" disabled={busy} onClick={() => void load()}>
          Yeniden yükle
        </button>
      ) : (
        <>
          <label>
            <input
              type="checkbox"
              checked={data.enabled}
              disabled={busy}
              onChange={(e) => void mutate("/ai/memory", "PATCH", { enabled: e.target.checked })}
            />{" "}
            Seyahat hafızasını kullan
          </label>
          <p>
            Kapatıldığında yeni hafıza kaydı oluşturulmaz ve geçmiş özetler kullanılmaz. Aşağıdaki
            açık tercihlerini ayrıca düzenleyebilir veya silebilirsin.
          </p>
          {Object.entries(preferenceChoices).map(([key, choices]) => (
            <div key={key} style={{ marginBlock: 16 }}>
              <label htmlFor={`memory-${key}`}>{labels[key]}</label>{" "}
              {key === "interests" ? (
                <span>{((data.preferences[key] as string[]) || []).join(", ") || "Kayıt yok"}</span>
              ) : (
                <select
                  id={`memory-${key}`}
                  disabled={busy}
                  value={(data.preferences[key] as string) || ""}
                  onChange={(e) =>
                    void mutate(`/ai/memory/${key}`, "PATCH", { value: e.target.value })
                  }
                >
                  <option value="" disabled>
                    Seçilmedi
                  </option>
                  {choices.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              )}{" "}
              <button
                type="button"
                disabled={busy || !data.preferences[key]}
                onClick={() => void mutate(`/ai/memory/${key}`, "DELETE")}
              >
                Bu tercihi unut
              </button>
              {key === "interests" && (
                <div>
                  {choices.map((value) => (
                    <label key={value} style={{ marginRight: 12 }}>
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={
                          Array.isArray(data.preferences.interests) &&
                          data.preferences.interests.includes(value)
                        }
                        onChange={(e) => {
                          const previous = Array.isArray(data.preferences.interests)
                            ? data.preferences.interests
                            : [];
                          void mutate("/ai/memory/interests", "PATCH", {
                            value: e.target.checked
                              ? [...previous, value]
                              : previous.filter((x) => x !== value),
                          });
                        }}
                      />
                      {value}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
          <p>
            Bir tercihi değiştirmek veya silmek, eski bilginin tekrar kullanılmaması için çıkarılmış
            seyahat özetlerini de temizler.
          </p>
          {data.memories.length > 0 && (
            <>
              <h3>Hatırlanan seyahatlerden örnekler</h3>
              <ul>
                {data.memories.map((m) => (
                  <li key={m.id}>{m.text}</li>
                ))}
              </ul>
            </>
          )}
          {data.deletion.status === "pending" && (
            <p>
              Eski hafızanın kullanımı durduruldu. Arka plandaki silme doğrulaması sürüyor; gecikmiş
              kayıtlar için kontroller 31 gün devam eder.
            </p>
          )}
          <button type="button" disabled={busy} onClick={() => setConfirm(true)}>
            Tüm AI hafızasını ve sohbet geçmişini sil
          </button>
          {confirm && (
            <div role="group" aria-label="Silme onayı">
              <p>
                Tercihlerin, AI sohbet geçmişin ve çıkarılmış özetler silinecek. Finansal işlem
                kayıtları korunur.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void mutate("/ai/memory", "DELETE", { scope: "all" })}
              >
                Evet, sil
              </button>{" "}
              <button type="button" disabled={busy} onClick={() => setConfirm(false)}>
                Vazgeç
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
