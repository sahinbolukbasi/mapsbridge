"use client";
// Oturumlu asistanın taslak paneli bölümleri (FEAT-013, design §4.1 Tabs, I11). Yalnızca sunucu
// yanıtındaki veriyi gösterir; değer uydurmaz (I1), olmayan bölümü boş durum metniyle anlatır
// (I10). Affiliate/Hazırlık içeriği BURADA YOK: o yalnızca travel-assistant-client.tsx'teki
// Hazırlık sekmesinde PrepPanel ile render edilir (I8, prep-isolation.test.cjs).
import type {
  EmergencyInfo,
  LocalDiscoveryInfo,
  RouteStop,
  StayAndTransitInfo,
  TravelAdvisoryInfo,
  UnifiedRoutePlan,
} from "../lib/ai/types";
import type { PinCategory } from "../lib/trip/models";
import {
  Alert,
  Badge,
  Button,
  Icon,
  Tabs,
  buttonClassName,
  type AlertTone,
  type IconName,
} from "../components/ui";
import { useLocale } from "../lib/locale-context";
import { dateLocale, fill } from "./studio-format";

/** addPlaceToActiveTrip girdisi (planlayıcı kaydına yazan mevcut işlev). */
export type PlaceInput = {
  label: string;
  address?: string;
  lat?: number;
  lng?: number;
  category?: string;
  note?: string;
  durationMinutes?: number;
  isHotel?: boolean;
};

const SLOT: Record<NonNullable<RouteStop["timeSlot"]>, [string, string]> = {
  morning: ["studio.slot.morning", "Sabah"],
  afternoon: ["studio.slot.afternoon", "Öğle"],
  evening: ["studio.slot.evening", "Akşam"],
  night: ["studio.slot.night", "Gece"],
};

/** Gün sekmeleri + seçili günün durakları. */
export function DraftStops({
  route,
  day,
  onDay,
}: {
  route: UnifiedRoutePlan;
  day: number;
  onDay: (day: number) => void;
}) {
  const { t } = useLocale();
  const days = Array.from({ length: Math.max(1, route.estimatedDays) }, (_, i) => i + 1);
  return (
    <Tabs
      variant="underline"
      label={t("studio.days.label", "Günler")}
      value={String(day)}
      onChange={(id) => onDay(Number(id))}
      items={days.map((d) => ({
        id: String(d),
        label: fill(t("studio.day", "{n}. Gün"), { n: d }),
        panel: (
          <ol className="as-studio-stops">
            {route.stops
              .filter((s) => s.day === d)
              .map((s, i) => (
                <li className="as-studio-stop" key={s.id}>
                  <span className="as-studio-stop__num" data-surface="inverse" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="as-studio-stop__body">
                    <div className="as-studio-stop__head">
                      <h4 className="as-studio-stop__name">{s.name}</h4>
                      {s.timeSlot && (
                        <Badge tone="neutral">{t(...(SLOT[s.timeSlot] ?? SLOT.afternoon))}</Badge>
                      )}
                    </div>
                    {s.address && <p className="as-studio__muted">{s.address}</p>}
                    <p className="as-studio-stop__desc">{s.description}</p>
                    <p className="as-studio__meta">
                      <Icon name="clock" size={16} />
                      {fill(t("studio.stop.duration", "Önerilen ziyaret: {d}"), {
                        d: s.suggestedDuration,
                      })}
                    </p>
                    {s.distanceToNextKm !== undefined && (
                      <p className="as-studio__meta">
                        <Icon name="walk" size={16} />
                        {fill(t("studio.stop.next", "Sonraki durağa kuş uçuşu ~{km} km"), {
                          km: s.distanceToNextKm,
                        })}
                      </p>
                    )}
                  </div>
                </li>
              ))}
          </ol>
        ),
      }))}
    />
  );
}

/** Bölüm verisi yoksa: sohbette sor (yalnızca girişi doldurur, istek göndermez). */
function AskInChat({
  text,
  onAsk,
  prompt,
}: {
  text: string;
  onAsk: (p: string) => void;
  prompt: string;
}) {
  const { t } = useLocale();
  return (
    <div className="as-studio-section__empty">
      <p className="as-studio__muted">{text}</p>
      <Button variant="secondary" size="sm" onClick={() => onAsk(prompt)}>
        {t("studio.ask", "Sohbette sor")}
      </Button>
    </div>
  );
}

function Heading({ icon, children }: { icon: IconName; children: string }) {
  return (
    <h4 className="as-studio-section__title">
      <Icon name={icon} size={16} />
      {children}
    </h4>
  );
}

export function DraftStay({
  info,
  onAsk,
  onAddPlace,
}: {
  info: StayAndTransitInfo | null | undefined;
  onAsk: (prompt: string) => void;
  onAddPlace: (place: PlaceInput) => void;
}) {
  const { t } = useLocale();
  if (!info)
    return (
      <AskInChat
        onAsk={onAsk}
        text={t(
          "studio.stay.empty",
          "Bu rota için ulaşım ve konaklama önerilerini sohbette sorabilirsin.",
        )}
        prompt={t(
          "studio.stay.prompt",
          "Mevcut rotama uygun konaklama bölgeleri ve şehir içi ulaşım seçenekleri öner; rotayı değiştirme.",
        )}
      />
    );
  return (
    <div className="as-studio-section">
      <div className="as-studio-section__group">
        <Heading icon="locate">{t("studio.stay.areas", "Önerilen konaklama semtleri")}</Heading>
        <ul className="as-studio-section__list">
          {info.recommendedAreas?.map((a, idx) => (
            <li key={idx}>{a}</li>
          ))}
        </ul>
      </div>
      <div className="as-studio-section__group">
        <Heading icon="bed">{t("studio.stay.types", "Önerilen otel ve konaklama tipleri")}</Heading>
        <ul className="as-studio-cards">
          {info.stays?.map((stay, idx) => (
            <li key={idx} className="as-studio-card">
              <div className="as-studio-card__head">
                <strong>{stay.name}</strong>
                <span className="as-studio__meta">
                  {stay.priceLevel} · {stay.type}
                </span>
              </div>
              <p className="as-studio__muted">{stay.area}</p>
              <p className="as-studio-card__text">{stay.description}</p>
              {stay.pros?.length > 0 && (
                <p className="as-studio__meta as-studio__meta--accent">
                  <Icon name="check" size={16} />
                  {stay.pros.join(" · ")}
                </p>
              )}
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  iconStart={<Icon name="bed" size={16} />}
                  onClick={() =>
                    onAddPlace({
                      label: stay.name,
                      address: stay.area,
                      isHotel: true,
                      category: "otel",
                      note: `${stay.type} · ${stay.priceLevel} - ${stay.description}`,
                    })
                  }
                >
                  {t("studio.stay.save", "Bu oteli rotama kaydet")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="as-studio-section__group">
        <Heading icon="transit">
          {t("studio.stay.transit", "Havalimanı ve şehir içi ulaşım")}
        </Heading>
        <ul className="as-studio-cards">
          {info.transitTips?.map((tip, idx) => (
            <li key={idx} className="as-studio-card">
              <strong>{tip.title}</strong>
              <p className="as-studio-card__text">{tip.description}</p>
              {tip.estimatedCost && (
                <p className="as-studio__meta">
                  {fill(t("studio.stay.cost", "Tahmini ücret: {cost}"), {
                    cost: tip.estimatedCost,
                  })}
                </p>
              )}
            </li>
          ))}
        </ul>
        {info.cityCardRecommendation && (
          <p className="as-studio-section__tip">
            <strong>{t("studio.stay.card", "Kart önerisi:")}</strong> {info.cityCardRecommendation}
          </p>
        )}
      </div>
    </div>
  );
}

export function DraftDiscovery({
  info,
  onAsk,
  onAddPlace,
}: {
  info: LocalDiscoveryInfo | null | undefined;
  onAsk: (prompt: string) => void;
  onAddPlace: (place: PlaceInput) => void;
}) {
  const { t } = useLocale();
  if (!info)
    return (
      <AskInChat
        onAsk={onAsk}
        text={t("studio.disc.empty", "Yerel lezzetler ve keşif önerilerini sohbette sorabilirsin.")}
        prompt={t(
          "studio.disc.prompt",
          "Mevcut rotamın şehrinde hangi yerel lezzetleri denemeliyim? Rotayı değiştirme.",
        )}
      />
    );
  return (
    <div className="as-studio-section">
      <div className="as-studio-section__group">
        <Heading icon="food">
          {t("studio.disc.specialties", "Mutlaka tadılması gereken spesiyaller")}
        </Heading>
        <ul className="as-studio-section__list">
          {info.specialties?.map((s, idx) => (
            <li key={idx}>{s}</li>
          ))}
        </ul>
      </div>
      <div className="as-studio-section__group">
        <Heading icon="compass">
          {t("studio.disc.gems", "Gizli köşeler ve otantik noktalar")}
        </Heading>
        <ul className="as-studio-cards">
          {info.gems?.map((gem, idx) => (
            <li key={idx} className="as-studio-card">
              <div className="as-studio-card__head">
                <strong>{gem.name}</strong>
                <span className="as-studio__meta">{gem.category}</span>
              </div>
              <p className="as-studio-card__text">{gem.description}</p>
              {gem.highlight && (
                <p className="as-studio__meta as-studio__meta--accent">
                  <Icon name="sparkle" size={16} />
                  {fill(t("studio.disc.highlight", "Özel: {text}"), { text: gem.highlight })}
                </p>
              )}
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  iconStart={<Icon name="plus" size={16} />}
                  onClick={() =>
                    onAddPlace({
                      label: gem.name,
                      category: (gem.category as PinCategory) || "aktivite",
                      note: `${gem.highlight ? gem.highlight + " - " : ""}${gem.description}`,
                    })
                  }
                >
                  {t("studio.disc.add", "Bu noktayı rotama ekle")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="as-studio-section__group">
        <Heading icon="info">
          {t("studio.disc.culture", "Yerel yaşam ve kültürel ipuçları")}
        </Heading>
        <ul className="as-studio-section__list">
          {info.cultureTips?.map((c, idx) => (
            <li key={idx}>{c}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const ADVISORY_TONE: Record<TravelAdvisoryInfo["level"], AlertTone> = {
  avoid: "danger",
  avoid_non_essential: "warning",
  some_risk: "warning",
  normal: "success",
};

export function DraftAdvisory({ info }: { info: TravelAdvisoryInfo | null | undefined }) {
  const { t, locale } = useLocale();
  if (!info)
    return (
      <p className="as-studio__muted">
        {t("studio.adv.none", "Seyahat tavsiyesi bu destinasyon için mevcut değil.")}
      </p>
    );
  return (
    <div className="as-studio-section">
      <Alert tone={ADVISORY_TONE[info.level] ?? "info"} title={info.levelLabel}>
        {info.country}
      </Alert>
      {info.summary && (
        <div className="as-studio-card">
          <Heading icon="info">{t("studio.adv.summary", "Özet tavsiye")}</Heading>
          <p className="as-studio-card__text">{info.summary}</p>
        </div>
      )}
      {info.changeNote && (
        <Alert tone="info" title={t("studio.adv.update", "Son güncelleme")}>
          {info.changeNote}
        </Alert>
      )}
      <p className="as-studio__meta">
        <Icon name="alert" size={16} />
        {info.disclaimer}
      </p>
      <div className="as-studio-section__links">
        <a
          href={info.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClassName("secondary", "sm")}
        >
          <Icon name="external" size={16} />
          <span>{t("studio.adv.fcdo", "FCDO kaynağı")}</span>
        </a>
        <a
          href="https://www.mfa.gov.tr/default.tr.mfa"
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClassName("secondary", "sm")}
        >
          <Icon name="external" size={16} />
          <span>{t("studio.adv.mfa", "T.C. Dışişleri")}</span>
        </a>
      </div>
      <p className="as-studio__meta">
        {fill(t("studio.adv.checked", "Son kontrol: {date} · Kaynak: FCDO GOV.UK"), {
          date: new Date(info.lastChecked).toLocaleString(dateLocale(locale)),
        })}
      </p>
    </div>
  );
}

export function DraftEmergency({ info }: { info: EmergencyInfo | null | undefined }) {
  const { t } = useLocale();
  if (!info)
    return (
      <p className="as-studio__muted">
        {t("studio.em.none", "Bu rota için ek güvenlik bilgisi alınamadı.")}
      </p>
    );
  const mission = info.turkishEmbassyConsulate;
  const numbers = info.localEmergencyNumbers;
  return (
    <div className="as-studio-section">
      <div className="as-studio-card">
        <Heading icon="landmark">
          {mission?.title || t("studio.em.mission", "T.C. Temsilciliği")}
        </Heading>
        {mission?.address && (
          <p className="as-studio__meta">
            <Icon name="locate" size={16} />
            {mission.address}
          </p>
        )}
        {mission?.phone && (
          <p className="as-studio__meta">
            <Icon name="phone" size={16} />
            {fill(t("studio.em.phone", "Tel: {n}"), { n: mission.phone })}
          </p>
        )}
        {mission?.emergencyHotline && (
          <p className="as-studio__meta as-studio__meta--danger">
            <Icon name="alert" size={16} />
            {fill(t("studio.em.hotline", "7/24 acil çağrı: {n}"), { n: mission.emergencyHotline })}
          </p>
        )}
        {mission?.workingHours && (
          <p className="as-studio__muted">
            {fill(t("studio.em.hours", "Çalışma saatleri: {h}"), { h: mission.workingHours })}
          </p>
        )}
      </div>
      <div className="as-studio-section__group">
        <Heading icon="phone">{t("studio.em.numbers", "Yerel acil numaralar")}</Heading>
        <dl className="as-studio-numbers">
          <div className="as-studio-numbers__item">
            <dt>{t("studio.em.police", "Polis")}</dt>
            <dd>{numbers?.police}</dd>
          </div>
          <div className="as-studio-numbers__item">
            <dt>{t("studio.em.ambulance", "Ambulans")}</dt>
            <dd>{numbers?.ambulance}</dd>
          </div>
          <div className="as-studio-numbers__item">
            <dt>{t("studio.em.fire", "İtfaiye")}</dt>
            <dd>{numbers?.fire}</dd>
          </div>
          <div className="as-studio-numbers__item">
            <dt>{t("studio.em.general", "Genel acil")}</dt>
            <dd>{numbers?.generalEmergency}</dd>
          </div>
        </dl>
      </div>
      <div className="as-studio-section__group">
        <Heading icon="shield">
          {t("studio.em.passport", "Pasaport kaybı ve güvenlik protokolü")}
        </Heading>
        <ul className="as-studio-section__list">
          {info.safetyAndPassportTips?.map((tip, idx) => (
            <li key={idx}>{tip}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
