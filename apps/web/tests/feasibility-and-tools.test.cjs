const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadModule(relativePath) {
  const ts = require('typescript');
  const fullPath = path.resolve(__dirname, '../app/lib/ai', relativePath);
  const code = fs.readFileSync(fullPath, 'utf8');
  const transformed = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const mod = { exports: {} };
  const fn = new Function('require', 'exports', 'module', '__filename', '__dirname', transformed);
  fn(require, mod.exports, mod, fullPath, path.dirname(fullPath));
  return mod.exports;
}

const feasibility = loadModule('feasibility.ts');
const gateway = loadModule('gateway-tools.ts');
const finops = loadModule('finops.ts');

test('schemas/trip-plan.json exists and conforms to section 5.4 plan output schema', () => {
  const schemaPath = path.resolve(__dirname, '../../../schemas/trip-plan.json');
  assert.equal(fs.existsSync(schemaPath), true);
  const raw = fs.readFileSync(schemaPath, 'utf8');
  const schema = JSON.parse(raw);
  assert.equal(schema.title, 'StructuredTripPlan');
  assert.equal(schema.properties.trip_id.type, 'string');
  assert.equal(schema.properties.days.type, 'array');
  assert.equal(schema.properties.budget_summary.type, 'object');
  assert.deepEqual(schema.required, ['trip_id', 'days', 'budget_summary', 'sources']);
});

test('validateTripPlanFeasibility approves a valid and balanced plan', () => {
  const plan = {
    trip_id: 't_123',
    days: [
      {
        date: '2026-11-10',
        weather_note: 'Açık, yağış riski yok',
        blocks: [
          {
            time: '09:00-10:00',
            type: 'cafe',
            place_id: 'p_1',
            name: 'Devoción Coffee',
            why: 'Nitelikli kahve sever',
            transit: { mode: 'walking', minutes: 5 },
            est_cost: 15,
          },
          {
            time: '10:30-12:30',
            type: 'museum',
            place_id: 'p_2',
            name: 'Metropolitan Museum of Art',
            why: 'Kültür ve sanat merakı',
            transit: { mode: 'subway', minutes: 20 },
            est_cost: 30,
          },
          {
            time: '13:00-14:30',
            type: 'restaurant',
            place_id: 'p_3',
            name: 'Local Burger Joint',
            why: 'Öğle yemeği',
            transit: { mode: 'walking', minutes: 10 },
            est_cost: 25,
          }
        ]
      }
    ],
    budget_summary: { total: 70, currency: 'USD' },
    sources: ['kb://nyc-coffee', 'api://places']
  };

  const report = feasibility.validateTripPlanFeasibility(plan, { budget: { total: 100, currency: 'USD' }, interests: { food: [], sports: [], culture: [], general: [] }, completeness: 0.8 });
  assert.equal(report.isValid, true);
  assert.equal(report.score, 1.0);
  assert.equal(report.issues.length, 0);
  assert.equal(report.estimatedCostTotal, 70);
  assert.equal(report.totalPlannedHours, 4.5);
});

test('validateTripPlanFeasibility detects time overlap errors', () => {
  const overlappingPlan = {
    trip_id: 't_overlap',
    days: [
      {
        date: '2026-11-10',
        weather_note: 'Açık',
        blocks: [
          {
            time: '09:00-11:00',
            type: 'cafe',
            place_id: 'p_1',
            name: 'Kafe 1',
            why: 'Kahve',
          },
          {
            time: '10:30-12:00', // overlaps with 09:00-11:00!
            type: 'museum',
            place_id: 'p_2',
            name: 'Müze 2',
            why: 'Sanat',
          }
        ]
      }
    ],
    budget_summary: { total: 50, currency: 'USD' },
    sources: []
  };

  const report = feasibility.validateTripPlanFeasibility(overlappingPlan);
  assert.equal(report.isValid, false);
  assert.equal(report.issues.some(i => i.code === 'TIME_OVERLAP' && i.severity === 'error'), true);
  assert.equal(report.score < 1.0, true);
});

test('validateTripPlanFeasibility warns on excessive duration (> 8.5 hours)', () => {
  const heavyPlan = {
    trip_id: 't_heavy',
    days: [
      {
        date: '2026-11-10',
        weather_note: 'Güneşli',
        blocks: [
          { time: '08:00-12:00', type: 'activity', place_id: 'p_1', name: 'Sabah Turu', why: 'Gezi' }, // 4h
          { time: '12:00-15:00', type: 'museum', place_id: 'p_2', name: 'Müze', why: 'Kültür' },      // 3h
          { time: '15:30-18:00', type: 'park', place_id: 'p_3', name: 'Park Gezisi', why: 'Yürüyüş' },// 2.5h (Total: 9.5h)
        ]
      }
    ],
    budget_summary: { total: 100, currency: 'USD' },
    sources: []
  };

  const report = feasibility.validateTripPlanFeasibility(heavyPlan);
  assert.equal(report.issues.some(i => i.code === 'EXCESSIVE_DURATION'), true);
  assert.equal(report.totalPlannedHours >= 9.0, true);
});

test('validateTripPlanFeasibility warns on missing rainy weather alternative for outdoor blocks', () => {
  const rainyPlanWithoutAlt = {
    trip_id: 't_rain',
    days: [
      {
        date: '2026-11-10',
        weather_note: 'Şiddetli yağmur ve fırtına bekleniyor',
        blocks: [
          {
            time: '14:00-16:00',
            type: 'park',
            place_id: 'p_park',
            name: 'Central Park',
            why: 'Yürüyüş',
            alt: '' // Missing rainy alt!
          }
        ]
      }
    ],
    budget_summary: { total: 0, currency: 'USD' },
    sources: []
  };

  const report = feasibility.validateTripPlanFeasibility(rainyPlanWithoutAlt);
  assert.equal(report.issues.some(i => i.code === 'MISSING_WEATHER_ALT'), true);
});

test('validateTripPlanFeasibility catches budget exceeded error', () => {
  const expensivePlan = {
    trip_id: 't_cost',
    days: [
      {
        date: '2026-11-10',
        weather_note: 'Açık',
        blocks: [
          { time: '19:00-21:00', type: 'restaurant', place_id: 'p_michelin', name: 'Michelin Restaurant', why: 'Akşam', est_cost: 450 }
        ]
      }
    ],
    budget_summary: { total: 450, currency: 'USD' },
    sources: []
  };

  const userProfile = {
    budget: { total: 200, currency: 'USD', level: 'budget' },
    interests: { food: [], sports: [], culture: [], general: [] },
    completeness: 0.8
  };

  const report = feasibility.validateTripPlanFeasibility(expensivePlan, userProfile);
  assert.equal(report.isValid, false);
  assert.equal(report.issues.some(i => i.code === 'BUDGET_EXCEEDED'), true);
});

test('AgentCore Gateway tools execute transit calculation accurately', () => {
  // Istanbul Taksim to Kadıköy coordinates
  const taksim = { lat: 41.0369, lng: 28.9850 };
  const kadikoy = { lat: 40.9906, lng: 29.0250 };

  const walking = gateway.executeTransitCalculation(taksim, kadikoy, 'walking');
  assert.equal(walking.mode, 'walking');
  assert.equal(walking.distanceKm > 4, true);
  assert.equal(walking.durationMinutes > 40, true);

  const subway = gateway.executeTransitCalculation(taksim, kadikoy, 'subway');
  assert.equal(subway.mode, 'subway');
  assert.equal(subway.durationMinutes < walking.durationMinutes, true);

  const weather = gateway.executeWeatherLookup('Paris');
  assert.equal(typeof weather.forecast, 'string');
  assert.equal(typeof weather.isRainy, 'boolean');
});

test('FinOps helpers produce cost allocation tags and token calculations', () => {
  const tags = finops.getCostAllocationTags('planner', 'sonnet', 'staging');
  assert.equal(tags['mapsbridge:service'], 'travel-ai');
  assert.equal(tags['mapsbridge:agent-role'], 'planner');
  assert.equal(tags['mapsbridge:model-tier'], 'sonnet');
  assert.equal(tags['mapsbridge:environment'], 'staging');

  // Arithmetic fixtures, not a live AWS price assertion.
  assert.equal(finops.estimateBedrockTokenCost('haiku', 1000, 500), null);
  const costHaiku = finops.estimateBedrockTokenCost('haiku', 1000, 500, {inputUsdPerMillion:1,outputUsdPerMillion:5});
  assert.equal(costHaiku > 0, true);
  assert.equal(costHaiku < 0.01, true);

  const costSonnet = finops.estimateBedrockTokenCost('sonnet', 1000, 500, {inputUsdPerMillion:3,outputUsdPerMillion:15});
  assert.equal(costSonnet > costHaiku, true);
});
