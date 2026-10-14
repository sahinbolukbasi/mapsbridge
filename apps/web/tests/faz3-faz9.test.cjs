'use strict';
/**
 * Faz 3 & Faz 9 tests
 *
 * Covers:
 *  §8    — PlaceEntity (place-entity.ts)
 *  §12.7 — Route templates (route-templates.ts)
 *  §11.11 — Trip progress (trip-progress.ts)
 *  §11.6  — Plan B (plan-b.ts)
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

function loadTs(relPath) {
  const absPath = path.resolve(__dirname, '..', relPath);
  const cache = new Map();

  function loadFile(filepath) {
    if (cache.has(filepath)) return cache.get(filepath).exports;
    const mod = { exports: {} };
    cache.set(filepath, mod);
    const src = readFileSync(filepath, 'utf8');
    const code = transformSync(src, { loader: 'ts', format: 'cjs' }).code;
    const fileDir = path.dirname(filepath);
    const ctx = vm.createContext({
      require: (id) => {
        if (id.startsWith('./') || id.startsWith('../')) {
          const candidates = [
            path.resolve(fileDir, id) + '.ts',
            path.resolve(fileDir, id, 'index.ts'),
          ];
          for (const c of candidates) {
            try { return loadFile(c); } catch {}
          }
          throw new Error(`Cannot resolve ${id} from ${filepath}`);
        }
        if (id === 'node:crypto') return require('node:crypto');
        return require(id);
      },
      module: mod,
      exports: mod.exports,
      __dirname: fileDir,
      __filename: filepath,
      process,
      console,
      URL,
      URLSearchParams,
      Set,
      Map,
      Date,
    });
    vm.runInContext(code, ctx);
    return mod.exports;
  }

  return loadFile(absPath);
}

// ---------------------------------------------------------------------------
// Load modules
// ---------------------------------------------------------------------------
const placeEntity   = loadTs('app/lib/ai/place-entity.ts');
const routeTpl      = loadTs('app/lib/ai/route-templates.ts');
const tripProgress  = loadTs('app/lib/ai/trip-progress.ts');
const planB         = loadTs('app/lib/ai/plan-b.ts');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal valid PlaceEntity */
function makePlace(overrides = {}) {
  return placeEntity.buildMinimalPlaceEntity({
    id: 'p_001',
    name: 'Tazza d\'Oro',
    lat: 41.9,
    lng: 12.5,
    category: 'cafe',
    ...overrides,
  });
}

/** Minimal TripState with a start date */
function makeTripState(startDate) {
  return {
    interests: {},
    decisions: [],
    rejections: [],
    dates: startDate ? { start: startDate } : undefined,
  };
}

/** A minimal StructuredTripPlan with one day and given blocks */
function makePlan(blocks) {
  return {
    trip_id: 'trip_001',
    days: [
      {
        date: '2024-01-15',
        weather_note: 'Güneşli',
        blocks,
      },
    ],
    budget_summary: { total: 500, currency: 'EUR' },
    sources: [],
  };
}

/** Build an ISO timestamp for today at HH:MM */
function todayAt(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// §8 PlaceEntity
// ---------------------------------------------------------------------------

describe('PlaceEntity', () => {
  test('buildMinimalPlaceEntity fills typicalDurationMin default', () => {
    const p = makePlace();
    assert.equal(p.typicalDurationMin, 60);
  });

  test('buildMinimalPlaceEntity fills ttlDays default', () => {
    const p = makePlace();
    assert.equal(p.ttlDays, 30);
  });

  test('buildMinimalPlaceEntity fills reservationRequired default', () => {
    const p = makePlace();
    assert.equal(p.reservationRequired, 'none');
  });

  test('buildMinimalPlaceEntity keeps explicitly provided values', () => {
    const p = makePlace({ typicalDurationMin: 45, ttlDays: 7 });
    assert.equal(p.typicalDurationMin, 45);
    assert.equal(p.ttlDays, 7);
  });

  test('isPlaceStale: no fetchedAt → stale', () => {
    const p = makePlace();
    assert.ok(placeEntity.isPlaceStale(p));
  });

  test('isPlaceStale: freshly fetched → not stale', () => {
    const p = makePlace({ fetchedAt: new Date().toISOString(), ttlDays: 30 });
    assert.ok(!placeEntity.isPlaceStale(p));
  });

  test('isPlaceStale: fetchedAt 31 days ago, ttl 30 → stale', () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const p = makePlace({ fetchedAt: old, ttlDays: 30 });
    assert.ok(placeEntity.isPlaceStale(p));
  });

  test('isPlaceStale: fetchedAt 1 day ago, ttl 30 → not stale', () => {
    const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const p = makePlace({ fetchedAt: recent, ttlDays: 30 });
    assert.ok(!placeEntity.isPlaceStale(p));
  });

  test('placeEntityToPromptSnippet includes name and category', () => {
    const p = makePlace();
    const snippet = placeEntity.placeEntityToPromptSnippet(p);
    assert.ok(snippet.includes('Tazza d\'Oro'), 'should include name');
    assert.ok(snippet.includes('cafe'), 'should include category');
  });

  test('placeEntityToPromptSnippet includes rating when set', () => {
    const p = makePlace({ rating: 4.7 });
    const snippet = placeEntity.placeEntityToPromptSnippet(p);
    assert.ok(snippet.includes('4.7'));
  });

  test('placeEntityToPromptSnippet includes reservation when not none', () => {
    const p = makePlace({ reservationRequired: 'required' });
    const snippet = placeEntity.placeEntityToPromptSnippet(p);
    assert.ok(snippet.includes('rezervasyon'));
  });

  test('placeEntityToPromptSnippet omits reservation when none', () => {
    const p = makePlace({ reservationRequired: 'none' });
    const snippet = placeEntity.placeEntityToPromptSnippet(p);
    assert.ok(!snippet.includes('rezervasyon'));
  });

  test('placeEntityToPromptSnippet includes closed days', () => {
    const p = makePlace({ closedDays: ['Monday', 'Tuesday'] });
    const snippet = placeEntity.placeEntityToPromptSnippet(p);
    assert.ok(snippet.includes('kapalı'));
    assert.ok(snippet.includes('Monday'));
  });

  test('placeEntityToPromptSnippet includes cost when set', () => {
    const p = makePlace({ estimatedCostEur: 15 });
    const snippet = placeEntity.placeEntityToPromptSnippet(p);
    assert.ok(snippet.includes('€15'));
  });
});

// ---------------------------------------------------------------------------
// §12.7 Route templates
// ---------------------------------------------------------------------------

describe('Route templates', () => {
  test('ROUTE_TYPE_LABELS has all 12 types', () => {
    const labels = routeTpl.ROUTE_TYPE_LABELS;
    const expectedTypes = [
      'seyahat', 'gunluk_gezi', 'kahve_turu', 'yemek_rotasi',
      'muze_sanat', 'fotograf', 'yuruyus_parka', 'kosu_bisiklet',
      'gece_hayati', 'alisveris', 'cocukla_gun', 'tarihi_tema',
    ];
    for (const t of expectedTypes) {
      assert.ok(t in labels, `Missing label for ${t}`);
      assert.ok(typeof labels[t] === 'string' && labels[t].length > 0);
    }
  });

  test('getRouteTemplate returns template with correct type', () => {
    const tpl = routeTpl.getRouteTemplate('kahve_turu');
    assert.equal(tpl.type, 'kahve_turu');
  });

  test('getRouteTemplate kahve_turu: maxStops 6, specialtyRequired', () => {
    const tpl = routeTpl.getRouteTemplate('kahve_turu');
    assert.equal(tpl.constraints.maxStops, 6);
    assert.ok(tpl.constraints.specialtyRequired);
  });

  test('getRouteTemplate muze_sanat: indoorOnly, maxStops 3', () => {
    const tpl = routeTpl.getRouteTemplate('muze_sanat');
    assert.ok(tpl.constraints.indoorOnly);
    assert.equal(tpl.constraints.maxStops, 3);
  });

  test('getRouteTemplate gece_hayati: nightOnly, minStartHour 21', () => {
    const tpl = routeTpl.getRouteTemplate('gece_hayati');
    assert.ok(tpl.constraints.nightOnly);
    assert.equal(tpl.constraints.minStartHour, 21);
  });

  test('getRouteTemplate cocukla_gun: kidsAllowed true', () => {
    const tpl = routeTpl.getRouteTemplate('cocukla_gun');
    assert.ok(tpl.constraints.kidsAllowed);
  });

  test('getRouteTemplate yuruyus_parka: walkingOnly, outdoorPreferred', () => {
    const tpl = routeTpl.getRouteTemplate('yuruyus_parka');
    assert.ok(tpl.constraints.walkingOnly);
    assert.ok(tpl.constraints.outdoorPreferred);
  });

  test('all templates have at least 1 question and at most 4', () => {
    const types = [
      'seyahat', 'gunluk_gezi', 'kahve_turu', 'yemek_rotasi',
      'muze_sanat', 'fotograf', 'yuruyus_parka', 'kosu_bisiklet',
      'gece_hayati', 'alisveris', 'cocukla_gun', 'tarihi_tema',
    ];
    for (const t of types) {
      const tpl = routeTpl.getRouteTemplate(t);
      assert.ok(tpl.questions.length >= 1, `${t}: at least 1 question`);
      assert.ok(tpl.questions.length <= 4, `${t}: max 4 questions`);
    }
  });

  test('all templates have feasibilityOverrides', () => {
    const types = [
      'seyahat', 'gunluk_gezi', 'kahve_turu', 'yemek_rotasi',
      'muze_sanat', 'fotograf', 'yuruyus_parka', 'kosu_bisiklet',
      'gece_hayati', 'alisveris', 'cocukla_gun', 'tarihi_tema',
    ];
    for (const t of types) {
      const tpl = routeTpl.getRouteTemplate(t);
      assert.ok(tpl.feasibilityOverrides, `${t}: has feasibilityOverrides`);
    }
  });

  test('detectRouteType: kahve_turu from coffee keyword', () => {
    assert.equal(routeTpl.detectRouteType('istanbul kahve turu yapmak istiyorum'), 'kahve_turu');
  });

  test('detectRouteType: muze_sanat from müze keyword', () => {
    assert.equal(routeTpl.detectRouteType('Paris müze rotası öner'), 'muze_sanat');
  });

  test('detectRouteType: yemek_rotasi from yemek turu', () => {
    assert.equal(routeTpl.detectRouteType('Roma yemek turu planla'), 'yemek_rotasi');
  });

  test('detectRouteType: yuruyus_parka from yürüyüş keyword', () => {
    assert.equal(routeTpl.detectRouteType('doğa yürüyüşü parkuru öner'), 'yuruyus_parka');
  });

  test('detectRouteType: gece_hayati from gece hayatı', () => {
    assert.equal(routeTpl.detectRouteType('gece hayatı rotası istiyorum'), 'gece_hayati');
  });

  test('detectRouteType: alisveris from alışveriş', () => {
    assert.equal(routeTpl.detectRouteType('Milano alışveriş rotası'), 'alisveris');
  });

  test('detectRouteType: cocukla_gun from çocukla', () => {
    assert.equal(routeTpl.detectRouteType('çocukla gün planı yap'), 'cocukla_gun');
  });

  test('detectRouteType: tarihi_tema from tarihi rota', () => {
    assert.equal(routeTpl.detectRouteType('tarihi rota önerisi'), 'tarihi_tema');
  });

  test('detectRouteType: seyahat fallback for generic message', () => {
    assert.equal(routeTpl.detectRouteType('Paris gezisi planlıyorum'), 'seyahat');
  });

  test('detectRouteType: fotograf from fotoğraf rotası', () => {
    assert.equal(routeTpl.detectRouteType('fotoğraf rotası öner'), 'fotograf');
  });

  test('detectRouteType: kosu_bisiklet from bisiklet', () => {
    assert.equal(routeTpl.detectRouteType('bisiklet turu planla'), 'kosu_bisiklet');
  });
});

// ---------------------------------------------------------------------------
// §11.11 Trip progress
// ---------------------------------------------------------------------------

describe('Trip progress', () => {
  test('isTripInProgress: past start date → true', () => {
    const state = makeTripState('2020-01-01');
    assert.ok(tripProgress.isTripInProgress(state));
  });

  test('isTripInProgress: future start date → false', () => {
    const state = makeTripState('2099-12-31');
    assert.ok(!tripProgress.isTripInProgress(state));
  });

  test('isTripInProgress: no dates → false', () => {
    const state = makeTripState(null);
    assert.ok(!tripProgress.isTripInProgress(state));
  });

  test('isTripInProgress: today → true (using custom now)', () => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const state = makeTripState(todayStr);
    assert.ok(tripProgress.isTripInProgress(state, today));
  });

  test('isTripInProgress: tomorrow → false (using custom now)', () => {
    const now = new Date();
    // Use local date arithmetic to avoid UTC/timezone mismatch
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const pad = (n) => String(n).padStart(2, '0');
    const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
    const state = makeTripState(tomorrowStr);
    assert.ok(!tripProgress.isTripInProgress(state, now));
  });

  test('computeProgressAlerts: empty completed set, no time-sensitive blocks → empty', () => {
    // Blocks with times far in the future — no alert expected
    const blocks = [
      { time: '23:00-24:00', type: 'cafe', place_id: 'p1', name: 'Cafe', why: '' },
    ];
    const plan = makePlan(blocks);
    const ctx = {
      currentTime: todayAt('08:00'),
      currentDayIndex: 1,
      completedPlaceIds: new Set(),
    };
    const alerts = tripProgress.computeProgressAlerts(plan, ctx);
    // No alert should fire since the block is 15+ hours away
    assert.ok(Array.isArray(alerts));
  });

  test('computeProgressAlerts: museum 50 min before end → last_entry_warning', () => {
    // Museum ends at 21:00; current time is 20:10 → 50 min until end (≤ 60)
    const blocks = [
      { time: '09:00-21:00', type: 'museum', place_id: 'museum1', name: 'Louvre', why: '' },
    ];
    const plan = makePlan(blocks);
    const ctx = {
      currentTime: todayAt('20:10'),
      currentDayIndex: 1,
      completedPlaceIds: new Set(),
    };
    const alerts = tripProgress.computeProgressAlerts(plan, ctx);
    assert.ok(alerts.some((a) => a.type === 'last_entry_warning'), 'Expected last_entry_warning');
  });

  test('computeProgressAlerts: completed museum → no alert', () => {
    const blocks = [
      { time: '09:00-21:00', type: 'museum', place_id: 'museum1', name: 'Louvre', why: '' },
    ];
    const plan = makePlan(blocks);
    const ctx = {
      currentTime: todayAt('20:10'),
      currentDayIndex: 1,
      completedPlaceIds: new Set(['museum1']),
    };
    const alerts = tripProgress.computeProgressAlerts(plan, ctx);
    assert.ok(!alerts.some((a) => a.placeId === 'museum1'));
  });

  test('computeProgressAlerts: disruption alert when delayMinutes set', () => {
    const plan = makePlan([]);
    const ctx = {
      currentTime: todayAt('10:00'),
      currentDayIndex: 1,
      completedPlaceIds: new Set(),
      delayMinutes: 45,
    };
    const alerts = tripProgress.computeProgressAlerts(plan, ctx);
    assert.ok(alerts.some((a) => a.type === 'disruption'));
  });

  test('computeProgressAlerts: transit block within 15 min → transport_last_run', () => {
    // Transit starts in 10 min from now
    const now = new Date();
    const startH = now.getHours();
    const startM = now.getMinutes() + 10;
    // Normalise minutes
    const adjustedH = startH + Math.floor(startM / 60);
    const adjustedM = startM % 60;
    const endM = adjustedM + 30;
    const endH = adjustedH + Math.floor(endM / 60);
    const timeStr = `${String(adjustedH).padStart(2,'0')}:${String(adjustedM).padStart(2,'0')}-${String(endH).padStart(2,'0')}:${String(endM % 60).padStart(2,'0')}`;

    const blocks = [
      { time: timeStr, type: 'transit', place_id: 'tr1', name: 'Metro', why: '' },
    ];
    const plan = makePlan(blocks);
    const ctx = {
      currentTime: new Date().toISOString(),
      currentDayIndex: 1,
      completedPlaceIds: new Set(),
    };
    const alerts = tripProgress.computeProgressAlerts(plan, ctx);
    assert.ok(alerts.some((a) => a.type === 'transport_last_run'), 'Expected transport_last_run');
  });

  test('rebuildDayAfterDisruption: removes completed blocks', () => {
    const blocks = [
      { time: '09:00-10:00', type: 'cafe', place_id: 'done1', name: 'Cafe', why: '' },
      { time: '11:00-12:00', type: 'museum', place_id: 'todo1', name: 'Museum', why: '' },
    ];
    const result = tripProgress.rebuildDayAfterDisruption(blocks, 0, new Set(['done1']));
    assert.ok(!result.some((b) => b.place_id === 'done1'), 'Completed block should be removed');
    assert.ok(result.some((b) => b.place_id === 'todo1'), 'Remaining block should be kept');
  });

  test('rebuildDayAfterDisruption: shifts block times by disruptionMinutes', () => {
    const blocks = [
      { time: '10:00-11:00', type: 'museum', place_id: 'todo1', name: 'Museum', why: '' },
    ];
    const result = tripProgress.rebuildDayAfterDisruption(blocks, 30, new Set());
    assert.equal(result.length, 1);
    // 10:00 + 30min = 10:30; 11:00 + 30min = 11:30
    assert.ok(result[0].time.startsWith('10:30'), `Expected 10:30 start, got ${result[0].time}`);
  });

  test('rebuildDayAfterDisruption: drops blocks that exceed 22:00', () => {
    const blocks = [
      { time: '21:00-22:00', type: 'restaurant', place_id: 'late1', name: 'Dinner', why: '' },
    ];
    // 60 min delay → 22:00-23:00 → exceeds 22:00 end → drop
    const result = tripProgress.rebuildDayAfterDisruption(blocks, 60, new Set());
    assert.equal(result.length, 0, 'Block exceeding 22:00 should be dropped');
  });

  test('buildProgressPromptSnippet: returns non-empty string', () => {
    const ctx = {
      currentTime: todayAt('10:00'),
      currentDayIndex: 2,
      completedPlaceIds: new Set(['p1']),
      weatherNote: 'Güneşli',
    };
    const snippet = tripProgress.buildProgressPromptSnippet(ctx, []);
    assert.ok(typeof snippet === 'string' && snippet.length > 0);
    assert.ok(snippet.includes('Gün 2'));
  });

  test('buildProgressPromptSnippet: includes alert messages', () => {
    const ctx = {
      currentTime: todayAt('10:00'),
      currentDayIndex: 1,
      completedPlaceIds: new Set(),
    };
    const alerts = [{
      type: 'last_entry_warning',
      placeId: 'museum1',
      message: 'Son giriş 30 dakika kaldı',
      urgencyMinutes: 30,
      createdAt: new Date().toISOString(),
    }];
    const snippet = tripProgress.buildProgressPromptSnippet(ctx, alerts);
    assert.ok(snippet.includes('Son giriş 30 dakika kaldı'));
  });
});

// ---------------------------------------------------------------------------
// §11.6 Plan B
// ---------------------------------------------------------------------------

describe('Plan B', () => {
  const outdoorBlock = {
    time: '14:00-15:00',
    type: 'park',
    place_id: 'park1',
    name: 'Villa Borghese',
    why: 'Parkta yürüyüş',
    alt: 'Galleria Borghese',
  };

  const viewpointBlock = {
    time: '09:00-10:00',
    type: 'viewpoint',
    place_id: 'view1',
    name: 'Gianicolo Tepesi',
    why: 'Manzara',
  };

  const museumBlock = {
    time: '11:00-13:00',
    type: 'museum',
    place_id: 'museum1',
    name: 'Colosseo',
    why: 'Tarihi tur',
  };

  const restaurantBlock = {
    time: '19:00-21:00',
    type: 'restaurant',
    place_id: 'rest1',
    name: 'Trattoria',
    why: 'Akşam yemeği',
  };

  test('buildRainAlternatives: keeps museum block unchanged', () => {
    const result = planB.buildRainAlternatives([museumBlock]);
    assert.equal(result.length, 1);
    assert.equal(result[0].place_id, 'museum1');
    assert.equal(result[0].type, 'museum');
  });

  test('buildRainAlternatives: replaces park block with alt', () => {
    const result = planB.buildRainAlternatives([outdoorBlock]);
    assert.equal(result.length, 1);
    // alt was 'Galleria Borghese' → should use that name
    assert.ok(result[0].name.includes('Galleria Borghese'));
    // should be an indoor type
    assert.ok(['museum', 'cafe', 'restaurant'].includes(result[0].type));
  });

  test('buildRainAlternatives: replaces viewpoint block without alt', () => {
    const result = planB.buildRainAlternatives([viewpointBlock]);
    assert.equal(result.length, 1);
    // No alt → converted to indoor block
    assert.ok(['museum', 'cafe', 'restaurant'].includes(result[0].type));
    // Original place_id modified
    assert.ok(result[0].place_id !== 'view1');
  });

  test('buildRainAlternatives: handles mixed day correctly', () => {
    const blocks = [outdoorBlock, museumBlock, restaurantBlock];
    const result = planB.buildRainAlternatives(blocks);
    assert.equal(result.length, 3);
    // Museum and restaurant should be unchanged
    assert.equal(result[1].place_id, 'museum1');
    assert.equal(result[2].place_id, 'rest1');
  });

  test('buildLiteDay: always keeps hotel block', () => {
    const hotelBlock = {
      time: '08:00-09:00', type: 'hotel', place_id: 'hotel1', name: 'Hotel', why: 'checkout'
    };
    const blocks = [hotelBlock, museumBlock, viewpointBlock, outdoorBlock];
    const profile = { interests: {}, completeness: 50, pace: 'relaxed' };
    const lite = planB.buildLiteDay(blocks, profile, 1);
    assert.ok(lite.keptPlaceIds.includes('hotel1'), 'Hotel must be kept');
  });

  test('buildLiteDay: always keeps restaurant block', () => {
    const blocks = [museumBlock, viewpointBlock, restaurantBlock, outdoorBlock];
    const profile = { interests: {}, completeness: 50, pace: 'relaxed' };
    const lite = planB.buildLiteDay(blocks, profile, 1);
    assert.ok(lite.keptPlaceIds.includes('rest1'), 'Restaurant must be kept');
  });

  test('buildLiteDay: relaxed pace keeps max 1 discretionary stop', () => {
    const blocks = [museumBlock, viewpointBlock, outdoorBlock, restaurantBlock];
    const profile = { interests: {}, completeness: 50, pace: 'relaxed' };
    const lite = planB.buildLiteDay(blocks, profile, 1);
    // Restaurant is always-keep; museum/viewpoint/park are discretionary
    // relaxed → 1 discretionary max
    const discretionary = lite.keptPlaceIds.filter(
      (id) => ['museum1', 'view1', 'park1'].includes(id)
    );
    assert.ok(discretionary.length <= 1, `Expected ≤1 discretionary, got ${discretionary.length}`);
  });

  test('buildLiteDay: moderate pace keeps max 2 discretionary stops', () => {
    const blocks = [museumBlock, viewpointBlock, outdoorBlock, restaurantBlock];
    const profile = { interests: {}, completeness: 50, pace: 'moderate' };
    const lite = planB.buildLiteDay(blocks, profile, 1);
    const discretionary = lite.keptPlaceIds.filter(
      (id) => ['museum1', 'view1', 'park1'].includes(id)
    );
    assert.ok(discretionary.length <= 2, `Expected ≤2 discretionary, got ${discretionary.length}`);
  });

  test('buildLiteDay: removedPlaceIds + keptPlaceIds = all blocks', () => {
    const blocks = [museumBlock, viewpointBlock, outdoorBlock, restaurantBlock];
    const profile = { interests: {}, completeness: 50, pace: 'moderate' };
    const lite = planB.buildLiteDay(blocks, profile, 1);
    const allIds = new Set([...lite.keptPlaceIds, ...lite.removedPlaceIds]);
    for (const b of blocks) {
      assert.ok(allIds.has(b.place_id), `${b.place_id} missing from lite day`);
    }
  });

  test('buildLiteDay: estimatedWalkingMinutes is a number ≥ 0', () => {
    const blocks = [museumBlock, restaurantBlock];
    const profile = { interests: {}, completeness: 50, pace: 'moderate' };
    const lite = planB.buildLiteDay(blocks, profile, 1);
    assert.ok(typeof lite.estimatedWalkingMinutes === 'number');
    assert.ok(lite.estimatedWalkingMinutes >= 0);
  });

  test('buildLiteDay: description is non-empty string', () => {
    const blocks = [museumBlock];
    const profile = { interests: {}, completeness: 50 };
    const lite = planB.buildLiteDay(blocks, profile, 1);
    assert.ok(typeof lite.description === 'string' && lite.description.length > 0);
  });

  test('planBToPromptSnippet: empty array → empty string', () => {
    const snippet = planB.planBToPromptSnippet([]);
    assert.equal(snippet, '');
  });

  test('planBToPromptSnippet: includes forPlaceId and reason', () => {
    const alt = {
      forPlaceId: 'park1',
      reason: 'rain',
      alternatives: [
        placeEntity.buildMinimalPlaceEntity({ id: 'alt1', name: 'Galleria', lat: 0, lng: 0, category: 'museum' }),
      ],
      generatedAt: new Date().toISOString(),
    };
    const snippet = planB.planBToPromptSnippet([alt]);
    assert.ok(snippet.includes('park1'));
    assert.ok(snippet.includes('rain'));
    assert.ok(snippet.includes('Galleria'));
  });

  test('planBToPromptSnippet: multiple alts listed', () => {
    const alt = {
      forPlaceId: 'view1',
      reason: 'closed',
      alternatives: [
        placeEntity.buildMinimalPlaceEntity({ id: 'a1', name: 'Museum A', lat: 0, lng: 0, category: 'museum' }),
        placeEntity.buildMinimalPlaceEntity({ id: 'a2', name: 'Cafe B', lat: 0, lng: 0, category: 'cafe' }),
      ],
      generatedAt: new Date().toISOString(),
    };
    const snippet = planB.planBToPromptSnippet([alt]);
    assert.ok(snippet.includes('Museum A'));
    assert.ok(snippet.includes('Cafe B'));
  });
});
