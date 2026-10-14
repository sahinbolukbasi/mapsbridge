"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api-client';
import { managementApi } from '../../lib/admin-management';
import { EditDialog } from './workspace';
import './ai-dashboard.css';
import { summarizeAICost } from '../../lib/ai/finops-summary';

type Control = { enabled: boolean; defaultModel: string; disabledModels: string[]; version: number };
type Operation = { id: string; kind: 'model' | 'request'; status: string; model?: string; role?: string; startedAt: string; updatedAt: string; durationMs?: number; errorCode?: string; inputTokens?: number; outputTokens?: number; estimatedModelCostUsd?: number | null; pricingStatus?: string; responseMode?: string; cacheReadInputTokens?: number; cacheWriteInputTokens?: number; agents?: { agentId: string; status: string; durationMs?: number }[] };
type Overview = { control: Control; runtime: null | { models: string[]; primaryModel: string; intakeModel: string; customModelEnabled: boolean; region: string; observedAt: string; services: { id: string; name: string; configured: boolean; purpose: string }[] }; events: Operation[]; truncated: boolean; observedAt: string };
type TrainingItem = { id: string; key: string; createdAt?: string; reviewed: boolean; privacyReview: string; source: string; metadata: Record<string, string>; messages: { role: string; content: string }[] };
type TrainingQueue = { records: TrainingItem[]; truncated: boolean; policy: { automaticTraining: boolean; requiresHumanReview: boolean; retentionDays: number; piiMaskedBeforeQueue: boolean }; observedAt: string };
type FineTuneJob = { jobArn?: string; jobName?: string; status?: string; baseModelArn?: string; customModelArn?: string; creationTime?: string; lastModifiedTime?: string; endTime?: string };
type FineTuneJobsResponse = { jobs: FineTuneJob[]; region: string; observedAt: string };
type GatewayTarget = { id: string; name: string; status: string; type: string };
type AgentCoreStatus = { observedAt: string; region: string; gateway: { id?: string; name?: string; status: string; url?: string; protocol?: string; targets?: GatewayTarget[]; error?: string }; memory: { id?: string; name?: string; status: string; strategies?: { name: string; type: string; status: string }[]; error?: string }; worker: { name: string; state?: string; lastUpdate?: string; errorsLastHour?: number; invocationsLastHour?: number; dlqMessages?: string | number; error?: string } };
type Release = { version: number; status: string; active?: { id: string; model: string; promptVersion: string; publishedAt?: string } | null; previousActive?: { id: string; model: string; promptVersion: string } | null; candidate?: { id: string; model: string; promptVersion: string; qualityGate: string; metrics: Record<string, number> } | null };
type ReleaseResponse = { release: Release; thresholds: Record<string, number>; policy: { automaticPublish: boolean; rollbackSupported: boolean; runtimeModelMutation: boolean }; observedAt: string };
type Agent = { id: string; name: string; description: string; wired: boolean; enabled: boolean; capabilities: string[] };
type AgentCatalog = { agents: Agent[]; version: number; policy: { userAccess: string; continuousWorkers: boolean; automaticModelTraining: boolean }; observedAt: string };
const date = (value?: string) => value ? new Date(value).toLocaleString('tr-TR') : '—';
const statusName = (status: string) => ({ succeeded: 'Başarılı', failed: 'Hata', running: 'İşleniyor', completed: 'Tamamlandı' }[status] || status);
export function AIDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [section, setSection] = useState('overview');
  const [query, setQuery] = useState('');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [editor, setEditor] = useState<Parameters<typeof EditDialog>[0]['editor'] | null>(null);
  const [training, setTraining] = useState<TrainingQueue | null>(null);
  const [trainingBusy, setTrainingBusy] = useState(false);
  const [finetuneJobs, setFinetuneJobs] = useState<FineTuneJobsResponse | null>(null);
  const [finetuneBusy, setFinetuneBusy] = useState(false);
  const [agentcoreStatus, setAgentcoreStatus] = useState<AgentCoreStatus | null>(null);
  const [release, setRelease] = useState<ReleaseResponse | null>(null);
  const [agentCatalog, setAgentCatalog] = useState<AgentCatalog | null>(null);
  const [releaseBusy, setReleaseBusy] = useState(false);
  const loading = useRef(false);
  const mounted = useRef(false);
  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true; setBusy(true);
    try {
      const [result, queue, releaseState, catalog, jobs, agentcore] = await Promise.all([apiFetch<Overview>('/admin/ai-operations'), apiFetch<TrainingQueue>('/admin/ai-training'), apiFetch<ReleaseResponse>('/admin/ai-release'), apiFetch<AgentCatalog>('/admin/ai-agents'), apiFetch<FineTuneJobsResponse>('/admin/ai-training/jobs').catch(() => null), apiFetch<AgentCoreStatus>('/admin/agentcore-status').catch(() => null)]);
      if (mounted.current) { setData(result); setTraining(queue); setRelease(releaseState); setAgentCatalog(catalog); setFinetuneJobs(jobs); setAgentcoreStatus(agentcore); setError(''); }
    }
    catch (err) { if (mounted.current) setError((err as Error).message || 'AI operasyon verileri alınamadı.'); }
    finally { loading.current = false; if (mounted.current) setBusy(false); }
  }, []);
  useEffect(() => { mounted.current = true; void load(); const timer = setInterval(() => { if (!document.hidden) void load(); }, 60000); return () => { mounted.current = false; clearInterval(timer); }; }, [load]);
  const edit = (title: string, patch: Partial<Control>, selectModel = false) => {
    if (!data) return;
    setEditor({ title, description: 'Kaydedilen ayarlar sonraki model çağrılarında uygulanır. Devam eden çağrılar iptal edilmez. İşlem gerekçesi denetim geçmişine kaydedilir.',
      values: { ...data.control, ...patch }, fields: selectModel ? [{ key: 'defaultModel', label: 'Varsayılan LLM', type: 'select', options: (data.runtime?.models || []).filter(id => !data.control.disabledModels.includes(id)).map(id => [id, id]) }] : [],
      save: values => managementApi.save('ai-control', values) });
  };
  const runtime = data?.runtime;
  const events = data?.events || [];
  const requests = events.filter(e => e.kind === 'request');
  const modelCalls = events.filter(e => e.kind === 'model');
  const finops = summarizeAICost(events);
  const usd = (value: number) => `$${value.toFixed(6)}`;
  const failures = events.filter(e => e.status === 'failed');
  const runtimeFresh = !!runtime && Date.now() - Date.parse(runtime.observedAt) < 86400000;
  const controllable = !!data && runtimeFresh && !busy && !error;
  const activeRequests = requests.filter(e => e.status === 'running' && Date.now() - Date.parse(e.updatedAt) < 120000);
  const staleRequests = requests.filter(e => e.status === 'running' && Date.now() - Date.parse(e.updatedAt) >= 120000);
  const observedAgents = new Set(requests.flatMap(e => (e.agents || []).map(a => a.agentId)));
  const filtered = events.filter(e => (!errorsOnly || e.status === 'failed') && `${e.model || ''} ${e.errorCode || ''} ${e.kind} ${e.role || ''}`.toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR')));
  const reviewTraining = async (item: TrainingItem, action: 'approve' | 'reject' | 'hold') => {
    setTrainingBusy(true);
    try {
      await apiFetch(`/admin/ai-training/${encodeURIComponent(item.key)}/review`, { method: 'POST', body: JSON.stringify({ action, reason: `AI Control Plane: ${action}` }) });
      setNotice(action === 'approve' ? 'Kayıt onaylandı ve dışa aktarım kuyruğuna alındı.' : action === 'reject' ? 'Kayıt reddedildi.' : 'Kayıt beklemeye alındı.');
      setTraining(await apiFetch<TrainingQueue>('/admin/ai-training'));
    } catch (err) { setError((err as Error).message || 'Eğitim kaydı güncellenemedi.'); }
    finally { setTrainingBusy(false); }
  };
  const startFineTune = async () => {
    if (!confirm('Onaylı kayıtlar Bedrock Titan fine-tuning işine gönderilecek. Devam edilsin mi?')) return;
    setFinetuneBusy(true);
    try {
      const result = await apiFetch<{ jobArn: string; jobName: string; recordCount: number; region: string }>('/admin/ai-training/fine-tune', {
        method: 'POST', body: JSON.stringify({ baseModelId: 'amazon.titan-text-express-v1' }),
      });
      setNotice(`Fine-tuning başlatıldı: ${result.jobName} · ${result.recordCount} kayıt · ${result.region}`);
      setFinetuneJobs(await apiFetch<FineTuneJobsResponse>('/admin/ai-training/jobs').catch(() => null));
    } catch (err) { setError((err as Error).message || 'Fine-tuning başlatılamadı.'); }
    finally { setFinetuneBusy(false); }
  };
  const rollbackRelease = async () => {
    setReleaseBusy(true);
    try {
      setRelease(await apiFetch<ReleaseResponse>('/admin/ai-release/rollback', { method: 'POST', body: JSON.stringify({ reason: 'AI Control Plane rollback' }) }));
      setNotice('AI release önceki güvenli sürüme alındı.');
    } catch (err) { setError((err as Error).message || 'Rollback uygulanamadı.'); }
    finally { setReleaseBusy(false); }
  };
  const toggleAgent = async (agent: Agent) => {
    setBusy(true);
    try {
      const next = await apiFetch<AgentCatalog>(`/admin/ai-agents/${encodeURIComponent(agent.id)}/config`, {
        method: 'POST',
        body: JSON.stringify({ enabled: !agent.enabled, reason: `AI Control Plane: ${agent.enabled ? 'agent kapatıldı' : 'agent açıldı'}` }),
      });
      setAgentCatalog(next);
      setNotice(`${agent.name}: ${agent.enabled ? 'pasif' : 'aktif'} duruma getirildi.`);
    } catch (err) { setError((err as Error).message || 'Agent ayarı güncellenemedi.'); }
    finally { setBusy(false); }
  };
  return <div className="ai-ops">
    <section className="ai-ops-hero"><div><span className="admin-eyebrow">AI OPERASYON MERKEZİ</span><h2>Asistanın arkasındaki her şey.</h2><p>Modeller, agent’lar, veri kaynakları ve çalışma kayıtları.</p></div><div><span className={`ai-pill ${error ? 'warning' : data?.control.enabled === false ? 'off' : 'neutral'}`}>{error ? 'Veri bağlantısında sorun' : data?.control.enabled === false ? 'AI yönetimden kapalı' : 'Sağlık: uçtan uca doğrulanmadı'}</span><small>Son veri: {date(data?.observedAt)}</small><button onClick={() => void load()} disabled={busy}>{busy ? 'Yenileniyor…' : '↻ AI verilerini yenile'}</button></div></section>
    {error && <p role="alert" className="admin-alert">{error} {data ? 'Önceki veriler gösteriliyor; ayar değişikliği kapalı.' : 'Operasyon verileri yüklenemedi.'}</p>}
    {notice && <p role="status" className="admin-notice">{notice}</p>}
    {!data && !error && <p className="admin-empty" role="status">AI operasyon verileri yükleniyor…</p>}
    {data && <>
      <div className="ai-ops-stats">{[
        ['Yapılandırılmış LLM', runtime ? String(runtime.models.length) : '—', 'Desteklenen sağlayıcı: Amazon Bedrock'],
        ['Gözlenen agent türü', String(observedAgents.size), 'Son 24 saatin listelenen isteklerinde'],
        ['İşlenen AI isteği', String(activeRequests.length), 'Son 2 dakika; listelenen kayıtlar'],
        ['Çalışan fiyat botu', '—', 'Canlı bot telemetrisi bağlı değil'],
        ['Hatalı kayıt', String(failures.length), 'Model ve istek hataları birlikte'],
      ].map(([label, value, hint]) => <article className="admin-card" key={label}><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>)}</div>
      <nav className="ai-ops-tabs" aria-label="AI operasyon bölümleri">{[['overview', 'Genel durum'], ['models', 'LLM yönetimi'], ['agents', 'Agent ve botlar'], ['agentcore', 'AgentCore'], ['training', 'Eğitim ve veriler'], ['release', 'Evaluation / release'], ['finops', 'Maliyet ve kullanım'], ['logs', 'Çağrı ve hata kayıtları']].map(([id, label]) => <button key={id} aria-pressed={section === id} onClick={() => setSection(id)}>{label}</button>)}</nav>
      {!runtimeFresh && <p className="admin-alert">{runtime ? 'AI çalışma ortamı bilgisi 24 saatten eski.' : 'AI çalışma ortamından henüz kayıt gelmedi.'} Model yönetimi için yeni bir AI isteğiyle çalışma ortamı kaydı alınmalıdır.</p>}
      {data.truncated && <p className="admin-alert">Son 24 saatteki en yeni 200 kayıt gösteriliyor. Sayaçlar yalnızca bu örnekleme aittir; günlük toplam değildir.</p>}
      {!events.length && <p className="admin-notice">Son 24 saatte operasyon kaydı yok. Bu durum sistemin sağlıklı veya kullanımın sıfır olduğunu doğrulamaz.</p>}
      {section === 'overview' && <>
        <div className="ai-ops-grid"><article className="admin-card"><h3>Asistanın çalışma akışı</h3><ol className="ai-flow"><li><b>İstek ve güvenlik</b><span>Oturum, kredi, yönetim ayarları ve kapsam denetimi</span></li><li><b>Niyet ve profil</b><span>Intake modeli → gerekirse varsayılan modele tek geri dönüş</span></li><li><b>Kaynak ve uzmanlar</b><span>Seyahat bilgi tabanı, mekan araştırması ve talebe göre alt agent’lar</span></li><li><b>Yanıt ve kayıt</b><span>Doğrulanmış yanıt, kredi işlemi ve operasyon kaydı</span></li></ol></article>
        <article className="admin-card"><h3>Operasyon özeti</h3><dl className="admin-details"><div><dt>AI çağrı izni</dt><dd>{data.control.enabled ? 'Açık' : 'Kapalı'}</dd></div><div><dt>Varsayılan model</dt><dd>{data.control.defaultModel || 'Doğrulanmadı'}</dd></div><div><dt>Model çağrısı</dt><dd>{modelCalls.length} kayıt</dd></div><div><dt>Son başarılı istek</dt><dd>{date(requests.find(e => e.status === 'succeeded')?.updatedAt)}</dd></div><div><dt>Sonucu belirsiz istek</dt><dd>{staleRequests.length} kayıt (2 dakikadan eski)</dd></div><div><dt>Bölge</dt><dd>{runtime?.region || '—'}</dd></div></dl><p className="ai-muted">Son başarılı istek geçmiş çalışmayı gösterir. Servis yapılandırması, anlık sağlık kontrolü değildir.</p></article></div>
        <section className="admin-card"><h3>Servisler</h3><div className="ai-services">{runtime?.services.map(service => <article key={service.id}><span className={`ai-pill ${service.configured ? 'neutral' : 'off'}`}>{service.configured ? 'Yapılandırılmış · sağlık ölçülmüyor' : 'Yapılandırılmamış'}</span><h4>{service.name}</h4><p>{service.purpose}</p></article>) || <p>Servis yapılandırması henüz gözlenmedi.</p>}</div></section>
      </>}
      {section === 'models' && <section className="admin-card"><div className="admin-header"><div><h3>LLM seçimi ve erişim</h3><p>Yalnızca AI çalışma ortamında yapılandırılmış model kimlikleri seçilebilir.</p></div><button disabled={!controllable} onClick={() => edit(data.control.enabled ? 'AI asistanını kapat' : 'AI asistanını aç', { enabled: !data.control.enabled })}>{data.control.enabled ? 'AI asistanını kapat' : 'AI asistanını aç'}</button></div><div className="admin-table-wrap"><table><thead><tr><th>Model</th><th>Görev</th><th>Durum</th><th>Yönetim</th></tr></thead><tbody>{runtime?.models.map(id => { const disabled = data.control.disabledModels.includes(id); return <tr key={id}><td><strong>{id}</strong><small>Amazon Bedrock</small></td><td>{id === data.control.defaultModel ? 'Varsayılan yanıt / geri dönüş' : 'Alternatif'}{id === runtime.intakeModel && <small>Özel intake: {runtime.customModelEnabled ? 'Etkin' : 'Ortamda kapalı'}</small>}</td><td><span className={`ai-pill ${disabled ? 'off' : 'neutral'}`}>{disabled ? 'Kapalı' : 'Çağrıya izinli'}</span></td><td><button disabled={!controllable || (!disabled && id === data.control.defaultModel && data.control.enabled)} onClick={() => edit(disabled ? 'Modeli aç' : 'Modeli kapat', { disabledModels: disabled ? data.control.disabledModels.filter(model => model !== id) : [...data.control.disabledModels, id] })}>{disabled ? 'Aç' : 'Kapat'}</button></td></tr>; })}</tbody></table></div><p>Etkin asistanın varsayılan modelini kapatmak için önce başka bir model seçin. Modeli açmak sağlayıcı erişimini veya model kalitesini doğrulamaz.</p><button disabled={!controllable || !runtime?.models.some(id => !data.control.disabledModels.includes(id))} onClick={() => edit('Varsayılan LLM seçimi', {}, true)}>Varsayılan LLM değiştir</button></section>}
      {section === 'agents' && <section className="admin-card"><h3>Agent envanteri</h3><p>{agentCatalog?.agents.length || 0} kayıt · {agentCatalog?.agents.filter(agent => agent.wired).length || 0} supervisor agent’ı bağlı. Etkin bağlı agent’lar tüm kimliği doğrulanmış AI kullanıcılarına açıktır; sürekli çalışan worker’lar henüz etkin değildir.</p><div className="admin-table-wrap"><table><thead><tr><th>Agent</th><th>Yetenekler</th><th>Durum</th><th>Son gözlem</th><th>Yönetim</th></tr></thead><tbody>{(agentCatalog?.agents || []).map(agent => { const last = requests.find(e => e.agents?.some(a => a.agentId === agent.id)); return <tr key={agent.id}><td><strong>{agent.name}</strong><small>{agent.description}</small></td><td>{agent.capabilities.join(', ')}</td><td><span className={`ai-pill ${agent.enabled && agent.wired ? 'neutral' : 'off'}`}>{agent.enabled && agent.wired ? 'Etkin · kullanıcıya açık' : agent.wired ? 'Pasif' : 'Bağlantı bekliyor'}</span></td><td>{last ? date(last.updatedAt) : '—'}</td><td><button disabled={busy || !agent.wired} onClick={() => void toggleAgent(agent)}>{agent.enabled ? 'Kapat' : 'Aç'}</button></td></tr>; })}</tbody></table></div><p className="ai-muted">Pasif veya henüz supervisor’a bağlanmamış agent’lar kullanıcı isteğinde çalıştırılmaz. Agent etkinleştirme ve kapatma audit kaydına yazılır.</p></section>}
      {section === 'agentcore' && <><section className="admin-card"><div className="admin-header"><div><h3>AgentCore Gateway</h3><p>MCP protokolü üzerinden seyahat araçlarını yöneten yönetilen ağ geçidi. AWS IAM kimlik doğrulaması ile korumalıdır.</p></div><span className={`ai-pill ${agentcoreStatus?.gateway?.status === 'READY' ? 'neutral' : 'warning'}`}>{agentcoreStatus?.gateway?.status || 'yükleniyor'}</span></div>{agentcoreStatus?.gateway?.url && <p className="ai-muted" style={{fontFamily:'monospace',fontSize:'0.7rem',wordBreak:'break-all'}}>{agentcoreStatus.gateway.url}</p>}<div className="admin-table-wrap"><table><thead><tr><th>Araç hedefi</th><th>Protokol</th><th>Durum</th></tr></thead><tbody>{(agentcoreStatus?.gateway?.targets || []).map(t => <tr key={t.id}><td><strong>{t.name}</strong><small>{t.id}</small></td><td>{agentcoreStatus?.gateway?.protocol || 'MCP'}</td><td><span className={`ai-pill ${t.status === 'READY' ? 'neutral' : 'warning'}`}>{t.status}</span></td></tr>)}{!agentcoreStatus?.gateway?.targets?.length && <tr><td colSpan={3}><p className="admin-empty">Gateway hedefleri yükleniyor…</p></td></tr>}</tbody></table></div></section>
      <section className="admin-card"><div className="admin-header"><div><h3>AgentCore Memory</h3><p>Kullanıcıların rıza verdiği seyahat tercihleri ve özet anılar. Her kullanıcı profil sayfasından opt-in yapmalıdır.</p></div><span className={`ai-pill ${agentcoreStatus?.memory?.status === 'ACTIVE' ? 'neutral' : 'warning'}`}>{agentcoreStatus?.memory?.status || 'yükleniyor'}</span></div><dl className="admin-details"><div><dt>Memory ID</dt><dd><code style={{fontSize:'0.7rem'}}>{agentcoreStatus?.memory?.id || '—'}</code></dd></div><div><dt>Adı</dt><dd>{agentcoreStatus?.memory?.name || '—'}</dd></div></dl><div className="admin-table-wrap"><table><thead><tr><th>Strateji</th><th>Tür</th><th>Durum</th></tr></thead><tbody>{(agentcoreStatus?.memory?.strategies || []).map(s => <tr key={s.name}><td><strong>{s.name}</strong></td><td><code style={{fontSize:'0.7rem'}}>{s.type}</code></td><td><span className={`ai-pill ${s.status === 'ACTIVE' ? 'neutral' : 'warning'}`}>{s.status}</span></td></tr>)}</tbody></table></div><p className="ai-muted">Memory sadece kullanıcı opt-in yaptıktan sonra dolar. Kullanıcılar /ai/memory sayfasından hafızayı açabilir. Yazma işleri asenkron olarak memory-worker Lambda tarafından işlenir.</p></section>
      <section className="admin-card"><h3>Memory Worker Sağlığı</h3><div className="ai-ops-stats">{[['Durum', agentcoreStatus?.worker?.state || '—', 'Lambda çalışma durumu'], ['Son güncelleme', agentcoreStatus?.worker?.lastUpdate || '—', 'Lambda config durumu'], ['Son 1 saat çalışma', String(agentcoreStatus?.worker?.invocationsLastHour ?? '—'), 'DynamoDB stream + saatlik sweep'], ['Son 1 saat hata', String(agentcoreStatus?.worker?.errorsLastHour ?? '—'), '0 olması beklenir'], ['DLQ mesaj sayısı', String(agentcoreStatus?.worker?.dlqMessages ?? '—'), '0 olması beklenir']].map(([label, value, hint]) => <article className="admin-card" key={label}><span>{label}</span><strong style={{color: (label.includes('hata') || label.includes('DLQ')) && value !== '0' && value !== '—' ? '#ef4444' : undefined}}>{value}</strong><small>{hint}</small></article>)}</div>{agentcoreStatus?.worker?.error && <p className="admin-alert">Worker durumu alınamadı: {agentcoreStatus.worker.error}</p>}</section></>}
      {section === 'training' && <><section className="admin-card"><div className="admin-header"><div><h3>İnsan onaylı eğitim kuyruğu</h3><p>Açık rızalı ve PII maskelenmiş kayıtlar burada incelenir. Onaylananlar S3'e aktarılır.</p></div><span className="ai-pill neutral">{training?.records.length || 0} kayıt</span></div>{!training?.records.length ? <p className="admin-empty">İncelenecek eğitim kaydı yok.</p> : <div className="admin-table-wrap"><table><thead><tr><th>Kayıt</th><th>Maskeli önizleme</th><th>Kaynak / model</th><th>Durum</th><th>Karar</th></tr></thead><tbody>{training.records.map(item => <tr key={item.key}><td><strong>{item.id.slice(0, 12)}…</strong><small>{date(item.createdAt)}</small></td><td>{item.messages.map((message, index) => <p key={index}><b>{message.role === 'user' ? 'Kullanıcı' : 'Asistan'}:</b> {message.content.slice(0, 180)}{message.content.length > 180 ? '…' : ''}</p>)}</td><td>{item.source}<small>{item.metadata.model || '—'} · {item.metadata.promptVersion || '—'}</small></td><td><span className="ai-pill warning">{item.privacyReview}</span></td><td><button disabled={trainingBusy || item.privacyReview === 'approved'} onClick={() => void reviewTraining(item, 'approve')}>Onayla</button> <button disabled={trainingBusy || item.privacyReview === 'rejected'} onClick={() => void reviewTraining(item, 'reject')}>Reddet</button> <button disabled={trainingBusy} onClick={() => void reviewTraining(item, 'hold')}>Beklet</button></td></tr>)}</tbody></table></div>}</section>
      <section className="admin-card"><div className="admin-header"><div><h3>Bedrock Titan Fine-Tuning</h3><p>Onaylı kayıtlar S3 karantinasından alınır, Titan JSONL formatına dönüştürülür ve Amazon Bedrock fine-tuning işi başlatılır.</p></div><button disabled={finetuneBusy} onClick={() => void startFineTune()}>{finetuneBusy ? 'Başlatılıyor…' : 'Eğitim Başlat (Titan)'}</button></div>{finetuneJobs?.jobs.length ? <div className="admin-table-wrap"><table><thead><tr><th>İş adı</th><th>Durum</th><th>Temel model</th><th>Özel model</th><th>Başlangıç</th><th>Bitiş</th></tr></thead><tbody>{finetuneJobs.jobs.map(job => <tr key={job.jobArn}><td><strong>{job.jobName || '—'}</strong><small style={{display:'block',wordBreak:'break-all',maxWidth:200}}>{job.jobArn?.split('/').pop()}</small></td><td><span className={`ai-pill ${job.status === 'Completed' ? 'neutral' : job.status === 'Failed' ? 'warning' : 'neutral'}`}>{job.status || '—'}</span></td><td><small>{job.baseModelArn?.split('/').pop() || '—'}</small></td><td><small>{job.customModelArn ? job.customModelArn.split('/').pop() : '—'}</small></td><td><small>{job.creationTime ? new Date(job.creationTime).toLocaleString('tr-TR') : '—'}</small></td><td><small>{job.endTime ? new Date(job.endTime).toLocaleString('tr-TR') : '—'}</small></td></tr>)}</tbody></table></div> : <p className="admin-empty">Henüz fine-tuning işi yok. {finetuneJobs?.region && <small>Bölge: {finetuneJobs.region}</small>}</p>}</section>
      <section className="admin-card"><h3>Öğrenme politikası</h3><ol className="ai-flow"><li><b>Topla</b><span>Açık rıza olmadan kullanıcı turu kuyruğa alınmaz.</span></li><li><b>İncele</b><span>Yalnızca maskeli önizleme; ham chain-of-thought ve gizli veriler gösterilmez.</span></li><li><b>Onayla &amp; Aktar</b><span>Onaylanan kayıtlar her 5 dakikada training-worker tarafından S3 karantinasına taşınır.</span></li><li><b>Fine-tune</b><span>Admin, "Eğitim Başlat" ile karantina verilerini Bedrock Titan JSONL formatında birleştirip fine-tuning işi başlatır.</span></li><li><b>Yayınla</b><span>Tamamlanan özel model ARN'si evaluation sürecinden geçtikten sonra aktif modele alınır.</span></li></ol></section></>}
      {section === 'release' && <><section className="admin-card"><div className="admin-header"><div><h3>Evaluation ve release durumu</h3><p>Kalite kapısı geçmeden aday yayınlanamaz. Bu ekran runtime modelini otomatik değiştirmez.</p></div><span className={`ai-pill ${release?.release.status === 'published' ? 'neutral' : 'warning'}`}>{release?.release.status || 'yükleniyor'}</span></div><dl className="admin-details"><div><dt>Aktif release</dt><dd>{release?.release.active ? `${release.release.active.model} · ${release.release.active.promptVersion}` : 'Henüz yok'}</dd></div><div><dt>Aday</dt><dd>{release?.release.candidate ? `${release.release.candidate.model} · ${release.release.candidate.qualityGate}` : 'Yok'}</dd></div><div><dt>Otomatik yayın</dt><dd>{release?.policy.automaticPublish ? 'Açık' : 'Kapalı'}</dd></div><div><dt>Runtime model değişimi</dt><dd>{release?.policy.runtimeModelMutation ? 'Açık' : 'Kapalı'}</dd></div></dl>{release?.release.previousActive && <button disabled={releaseBusy} onClick={() => void rollbackRelease()}>{releaseBusy ? 'Geri alınıyor…' : 'Önceki release’e dön'}</button>}</section><section className="admin-card"><h3>Kalite eşikleri</h3><p>Evaluation çalıştırmadan elle release önerisi oluşturulamaz; backend yalnızca ölçülmüş metrikleri kabul eder.</p><div className="admin-table-wrap"><table><thead><tr><th>Metrik</th><th>Eşik</th><th>Anlam</th></tr></thead><tbody>{Object.entries(release?.thresholds || {}).map(([key, value]) => <tr key={key}><td><code>{key}</code></td><td>{key === 'p95LatencyMs' ? `${value} ms altında` : `${(value * 100).toFixed(1)}%`}</td><td>Golden/evaluation raporundaki doğrulanmış sonuç</td></tr>)}</tbody></table></div></section></>}
      {section === 'finops' && <section className="admin-card"><h3>Maliyet ve kullanım</h3><p>Son 24 saatin listelenen en fazla 200 kaydı. Tutarlar model token maliyeti tahminidir; AWS faturası, kullanıcı kredisi veya toplam servis maliyeti değildir. Memory, Gateway, harita, Guardrails ve altyapı bedelleri bu tutara dahil değildir.</p>
        <dl className="admin-details">
          <div><dt>Fiyatı bilinen model kullanımı</dt><dd>{finops.modelCalls && finops.unpricedCalls < finops.modelCalls ? usd(finops.knownModelCostUsd) : '—'}</dd></div>
          <div><dt>Fiyatlandırılamayan model kaydı</dt><dd>{finops.unpricedCalls} / {finops.modelCalls}</dd></div>
          <div><dt>Giriş / çıkış tokenları</dt><dd>{finops.inputTokens} / {finops.outputTokens}</dd></div>
          <div><dt>Önbellek okuma ve yazma tokenları</dt><dd>{finops.cachedTokens}</dd></div>
          <div><dt>Tamamlanan plan başına model maliyeti</dt><dd>{finops.averagePlanModelCostUsd === null ? '—' : usd(finops.averagePlanModelCostUsd)}</dd></div>
          <div><dt>Maliyeti hesaplanan / tamamlanan plan</dt><dd>{finops.pricedPlans} / {finops.completedPlans}</dd></div>
        </dl>
        {finops.unpricedCalls > 0 && <p className="admin-alert">Eksik veya eski fiyat/kullanım verisi var. Bilinen maliyet toplamı eksiktir; bilinmeyen kullanım ücretsiz sayılmaz.</p>}
        <p>Başarısız yanıtların bilinen token maliyetleri de toplamda tutulur. Plan ortalaması yalnız tam fiyatlandırılmış başarılı planları kapsar. Kesin harcama AWS Cost Explorer ve fatura ile karşılaştırılmalıdır.</p>
      </section>}
      {section === 'logs' && <section className="admin-card"><h3>Çağrılar ve hatalar</h3><p>Son 24 saat, en fazla 200 kayıt. İstek ve model çağrısı ayrı satırlardır. Mesaj içerikleri ve kullanıcı kimlikleri kaydedilmez.</p><div className="admin-toolbar"><label>Model veya hata kodu ara<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Model kimliği, hata kodu…" /></label><label className="ai-check"><input type="checkbox" checked={errorsOnly} onChange={e => setErrorsOnly(e.target.checked)} />Yalnızca hatalar</label></div>{!filtered.length ? <p className="admin-empty">Bu filtrede kayıt yok.</p> : <div className="admin-table-wrap"><table><thead><tr><th>Zaman / tür</th><th>Model / görev</th><th>Durum</th><th>Süre / token</th><th>Hata kodu</th></tr></thead><tbody>{filtered.map(event => <tr key={event.id}><td>{date(event.updatedAt)}<small>{event.kind === 'request' ? 'AI isteği' : 'Model çağrısı'}</small></td><td>{event.model || '—'}<small>{event.role || '—'}</small></td><td><span className={`ai-pill ${event.status === 'failed' ? 'warning' : 'neutral'}`}>{statusName(event.status)}</span></td><td>{event.durationMs === undefined ? '—' : `${event.durationMs} ms`}<small>{event.inputTokens === undefined ? '' : `${event.inputTokens} giriş / ${event.outputTokens ?? 0} çıkış`}</small></td><td><code>{event.errorCode || '—'}</code></td></tr>)}</tbody></table></div>}</section>}
    </>}
    {editor && <EditDialog editor={editor} close={() => setEditor(null)} saved={() => { setNotice('AI ayarları kaydedildi. Sonraki model çağrılarında uygulanacak.'); void load(); }} />}
  </div>;
}
