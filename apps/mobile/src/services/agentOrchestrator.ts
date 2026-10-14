/**
 * @mapsbridge/mobile
 * Agent Orchestrator (Ajan Orkestrası)
 *
 * Sohbet akışında kullanıcı mesajını analiz eder, ilgili sub-agent'ları
 * paralel veya sıralı olarak çalıştırır, sonuçları birleştirir ve
 * orkestra şefi gibi tüm görevi koordine eder.
 *
 * Çalışma prensibi:
 *   1. AgentDispatcher ile intent tespit et
 *   2. Intent'e uygun agent'ları tetikle
 *   3. Görevleri kayıt al (TaskLedger)
 *   4. Sonuçları birleştir ve kullanıcıya zengin yanıt döndür
 */

import { AgentDispatcher, SystemIntentAction } from './agentDispatcher';
import { aiService } from './api';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AgentTaskStatus = 'pending' | 'running' | 'done' | 'error';

export interface AgentTask {
  id: string;
  agentName: string;
  intent: SystemIntentAction;
  status: AgentTaskStatus;
  startedAt: number;
  completedAt?: number;
  result?: AgentTaskResult;
  error?: string;
}

export interface AgentTaskResult {
  type: 'emergency' | 'food' | 'lodging' | 'transit' | 'events' | 'weather' | 'chat' | 'route';
  data: any;
  summary: string;       // 1-2 cümle ozet
  richCard?: RichAgentCard;
}

export interface RichAgentCard {
  title: string;
  emoji: string;
  bullets: string[];
  actionLabel?: string;
  actionData?: any;
}

// ─── Backend-backed Agent Runners ────────────────────────────────────────────
// Each runner attempts to call the backend AI agent service.
// If the endpoint is not yet available, it returns a clear "coming soon" message
// instead of fake/hardcoded data.

const FEATURE_COMING_SOON = 'Bu ozellik yakinda aktif olacak';

async function runAgentViaBackend(
  agentType: string,
  city?: string,
  query?: string,
): Promise<AgentTaskResult> {
  try {
    const res = await aiService.ask(`[agent:${agentType}] ${query || city || ''}`, {
      conversationId: `agent-${agentType}-${Date.now()}`,
      history: [],
    });
    if (res?.answer) {
      return {
        type: agentType as AgentTaskResult['type'],
        data: res,
        summary: res.answer.slice(0, 200),
        richCard: {
          title: `${city || ''} - ${agentType}`,
          emoji: '',
          bullets: [res.answer.slice(0, 300)],
        },
      };
    }
    throw new Error('Empty response');
  } catch {
    return {
      type: agentType as AgentTaskResult['type'],
      data: null,
      summary: `${FEATURE_COMING_SOON} (${agentType})`,
      richCard: {
        title: `${city || 'Bilgi'} - ${agentType}`,
        emoji: '',
        bullets: [FEATURE_COMING_SOON],
      },
    };
  }
}

async function runEmergencyAgent(city?: string): Promise<AgentTaskResult> {
  return runAgentViaBackend('emergency', city, `${city || ''} acil durum numaralari`);
}

async function runFoodAgent(city?: string, query?: string): Promise<AgentTaskResult> {
  return runAgentViaBackend('food', city, query || `${city || ''} yemek onerileri`);
}

async function runWeatherAgent(city?: string): Promise<AgentTaskResult> {
  return runAgentViaBackend('weather', city, `${city || ''} hava durumu`);
}

async function runTransitAgent(city?: string, destination?: string): Promise<AgentTaskResult> {
  return runAgentViaBackend('transit', city, `${city || ''} ulasim ${destination || ''}`);
}

async function runEventsAgent(city?: string): Promise<AgentTaskResult> {
  return runAgentViaBackend('events', city, `${city || ''} etkinlikler`);
}

// ─── Task Ledger (Görev Defteri) ──────────────────────────────────────────────

class TaskLedger {
  private tasks: AgentTask[] = [];

  add(task: Omit<AgentTask, 'id' | 'startedAt'>): AgentTask {
    const t: AgentTask = { ...task, id: `task-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, startedAt: Date.now() };
    this.tasks.push(t);
    return t;
  }

  update(id: string, patch: Partial<AgentTask>) {
    const t = this.tasks.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
  }

  getAll(): AgentTask[] { return [...this.tasks]; }
  getActive(): AgentTask[] { return this.tasks.filter((t) => t.status === 'running' || t.status === 'pending'); }
  getLast(): AgentTask | undefined { return this.tasks[this.tasks.length - 1]; }
  clear() { this.tasks = []; }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export interface OrchestratorResult {
  answer: string;
  agentCards: RichAgentCard[];
  tasks: AgentTask[];
  shouldCallMainAI: boolean;  // eğer agent kısmen yanıtlıyorsa AI'a da sor
  intent: SystemIntentAction;
}

export class AgentOrchestrator {
  private ledger = new TaskLedger();

  /**
   * Analyzes user message, triggers appropriate agents, collects results.
   * Returns enriched answer + rich cards for UI rendering.
   */
  async orchestrate(prompt: string, city?: string): Promise<OrchestratorResult> {
    const dispatch = AgentDispatcher.detectIntent(prompt, city);
    const intent = dispatch.action;
    const cards: RichAgentCard[] = [];
    const agentResults: AgentTaskResult[] = [];

    // ── Run agents based on intent ─────────────────────────────────────────

    if (intent === 'emergency_safety') {
      const task = this.ledger.add({ agentName: 'EmergencyAgent', intent, status: 'running' });
      const result = await runEmergencyAgent(city);
      this.ledger.update(task.id, { status: 'done', completedAt: Date.now(), result });
      agentResults.push(result);
      if (result.richCard) cards.push(result.richCard);
    }

    if (intent === 'find_food') {
      // Paralel: yemek + hava durumu (açık hava terası için)
      const [foodTask, weatherTask] = [
        this.ledger.add({ agentName: 'FoodAgent', intent, status: 'running' }),
        this.ledger.add({ agentName: 'WeatherAgent', intent: 'general_chat', status: 'running' }),
      ];
      const [foodResult, weatherResult] = await Promise.all([
        runFoodAgent(city, prompt),
        runWeatherAgent(city),
      ]);
      this.ledger.update(foodTask.id, { status: 'done', completedAt: Date.now(), result: foodResult });
      this.ledger.update(weatherTask.id, { status: 'done', completedAt: Date.now(), result: weatherResult });
      agentResults.push(foodResult, weatherResult);
      if (foodResult.richCard) cards.push(foodResult.richCard);
      if (weatherResult.richCard) cards.push(weatherResult.richCard);
    }

    if (intent === 'transit_directions') {
      const task = this.ledger.add({ agentName: 'TransitAgent', intent, status: 'running' });
      const result = await runTransitAgent(city, prompt);
      this.ledger.update(task.id, { status: 'done', completedAt: Date.now(), result });
      agentResults.push(result);
      if (result.richCard) cards.push(result.richCard);
    }

    if (intent === 'find_lodging') {
      // Konaklama: hava + ulaşım bilgisi ile birlikte
      const [weatherTask, transitTask] = [
        this.ledger.add({ agentName: 'WeatherAgent', intent: 'general_chat', status: 'running' }),
        this.ledger.add({ agentName: 'TransitAgent', intent: 'transit_directions', status: 'running' }),
      ];
      const [wResult, tResult] = await Promise.all([runWeatherAgent(city), runTransitAgent(city)]);
      this.ledger.update(weatherTask.id, { status: 'done', completedAt: Date.now(), result: wResult });
      this.ledger.update(transitTask.id, { status: 'done', completedAt: Date.now(), result: tResult });
      agentResults.push(wResult, tResult);
      if (wResult.richCard) cards.push(wResult.richCard);
      if (tResult.richCard) cards.push(tResult.richCard);
    }

    if (intent === 'plan_itinerary') {
      // Rota planlama: hava + etkinlikler arka planda çalışsın
      const [wTask, eTask] = [
        this.ledger.add({ agentName: 'WeatherAgent', intent: 'general_chat', status: 'running' }),
        this.ledger.add({ agentName: 'EventsAgent', intent: 'general_chat', status: 'running' }),
      ];
      const [wResult, eResult] = await Promise.all([runWeatherAgent(city), runEventsAgent(city)]);
      this.ledger.update(wTask.id, { status: 'done', completedAt: Date.now(), result: wResult });
      this.ledger.update(eTask.id, { status: 'done', completedAt: Date.now(), result: eResult });
      agentResults.push(wResult, eResult);
      if (wResult.richCard) cards.push(wResult.richCard);
      if (eResult.richCard) cards.push(eResult.richCard);
    }

    // ── Build composite answer ────────────────────────────────────────────
    const summaries = agentResults.map((r) => r.summary).filter(Boolean);
    const compositeAnswer = summaries.length > 0
      ? summaries.join('\n\n')
      : '';

    const shouldCallMainAI = intent === 'plan_itinerary' || intent === 'general_chat';

    return {
      answer: compositeAnswer,
      agentCards: cards,
      tasks: this.ledger.getAll(),
      shouldCallMainAI,
      intent,
    };
  }

  getTaskLedger(): AgentTask[] {
    return this.ledger.getAll();
  }

  clearLedger() {
    this.ledger.clear();
  }
}

// Singleton instance — persists across renders in the same session
export const agentOrchestrator = new AgentOrchestrator();
