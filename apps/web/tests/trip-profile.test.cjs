const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Test helper: import TypeScript module using ts-node or harness
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

const planning = loadModule('planning.ts');

test('schemas/trip-profile.json exists and is valid JSON Schema', () => {
  const schemaPath = path.resolve(__dirname, '../../../schemas/trip-profile.json');
  assert.equal(fs.existsSync(schemaPath), true);
  const raw = fs.readFileSync(schemaPath, 'utf8');
  const schema = JSON.parse(raw);
  assert.equal(schema.title, 'TripProfile');
  assert.equal(schema.properties.destination.type, 'string');
  assert.equal(schema.properties.duration_days.type, 'integer');
  assert.equal(schema.properties.completeness.type, 'number');
  assert.deepEqual(schema.required, ['interests', 'completeness']);
});

test('calculateTripCompleteness scores completeness accurately', () => {
  // Empty profile
  assert.equal(planning.calculateTripCompleteness({ interests: { food: [], sports: [], culture: [], general: [] } }), 0);

  // Destination only
  const withDest = { destination: 'New York', interests: { food: [], sports: [], culture: [], general: [] } };
  assert.equal(planning.calculateTripCompleteness(withDest), 0.35);

  // Destination + duration
  const withDuration = { destination: 'New York', duration_days: 4, interests: { food: [], sports: [], culture: [], general: [] } };
  assert.equal(planning.calculateTripCompleteness(withDuration), 0.60);

  // Destination + duration + 3 interests
  const withInterests = {
    destination: 'New York',
    duration_days: 4,
    interests: { food: ['specialty_coffee', 'burgers'], culture: ['museums'], sports: [], general: [] }
  };
  assert.equal(planning.calculateTripCompleteness(withInterests), 0.75);

  // Fully loaded profile (destination + duration + interests + budget + pace + travelers + constraints)
  const fullProfile = {
    destination: 'New York',
    duration_days: 4,
    interests: { food: ['specialty_coffee', 'burgers'], culture: ['museums'], sports: ['running'], general: [] },
    budget: { level: 'mid', total: 3500, currency: 'USD' },
    pace: 'relaxed',
    travelers: { adults: 2, children: 0, pets: false },
    constraints: ['deniz ürünü yok', 'kalabalıktan uzak'],
    lodging_type: ['hotel'],
    needs: { flights: true, car_rental: false, local_transit: true }
  };
  const score = planning.calculateTripCompleteness(fullProfile);
  assert.equal(score >= 0.95, true);
  assert.equal(score <= 1.0, true);
});

test('cleanTripProfile sanitizes untrusted input safely', () => {
  const dirty = {
    destination: '  İstanbul, Türkiye  ',
    duration_days: 45, // invalid > 30
    days: 5,           // fallback to 5
    interests: {
      food: ['  kebap  ', 'kahve', 'kebap'], // should trim & deduplicate
      culture: ['galata kulesi'],
    },
    pace: 'super_fast', // invalid enum
    lodging_type: ['hotel', 'treehouse'], // 'treehouse' not in enum
    budget: { currency: 'TRY', total: 10000, level: 'mid' },
    travelers: { adults: 25, children: 2 }, // adults clamped to 20
    constraints: ['  glütensiz  ']
  };

  const cleaned = planning.cleanTripProfile(dirty);
  assert.equal(cleaned.destination, 'İstanbul, Türkiye');
  assert.equal(cleaned.duration_days, 5);
  assert.deepEqual(cleaned.interests.food, ['kebap', 'kahve']);
  assert.deepEqual(cleaned.interests.culture, ['galata kulesi']);
  assert.equal(cleaned.pace, undefined);
  assert.deepEqual(cleaned.lodging_type, ['hotel']);
  assert.equal(cleaned.travelers.adults, 20);
  assert.deepEqual(cleaned.constraints, ['glütensiz']);
  assert.equal(cleaned.completeness > 0.5, true);
});

test('mergeTripProfile handles explicit overrides and captures negative constraints', () => {
  const previous = planning.cleanTripProfile({
    destination: 'Roma',
    duration_days: 3,
    interests: { food: ['pizza', 'makarna'], culture: ['kolezyum'], sports: [], general: [] },
    constraints: ['yürüme mesafesinde']
  });

  const userText = 'Paris için 4 günlük plan yapalım, balık yemem ve kalabalık sevmem';
  const updates = {
    destination: 'Paris',
    destinationMention: 'Paris',
    duration_days: 4,
    daysMention: '4 günlük',
    interests: { food: ['kruvasan'] }
  };

  const merged = planning.mergeTripProfile(previous, updates, userText);
  assert.equal(merged.destination, 'Paris');
  assert.equal(merged.duration_days, 4);
  assert.equal(merged.interests.food.includes('kruvasan'), true);
  assert.equal(merged.interests.food.includes('pizza'), true);
  assert.equal(merged.constraints.includes('deniz ürünü / balık yok'), true);
  assert.equal(merged.constraints.includes('kalabalıktan uzak'), true);
});

test('generateConciergeQuestion adheres to single-turn inquiry and produces quick options', () => {
  // Case 1: Missing destination
  const q1 = planning.generateConciergeQuestion({ interests: { food: [], sports: [], culture: [], general: [] }, completeness: 0 });
  assert.match(q1.question, /hangi şehre/i);
  assert.equal((q1.question.match(/\?/g) || []).length, 1);
  assert.equal(q1.quickOptions.length >= 3, true);
  assert.equal(q1.quickOptions.some(o => o.label.includes('New York')), true);

  // Case 2: Missing duration
  const q2 = planning.generateConciergeQuestion({ destination: 'New York', interests: { food: [], sports: [], culture: [], general: [] }, completeness: 0.35 });
  assert.match(q2.question, /kaç günlük/);
  assert.equal(q2.quickOptions.some(o => o.label.includes('3 Gün') || o.label.includes('Hafta sonu')), true);

  // Case 3: Missing interests
  const q3 = planning.generateConciergeQuestion({ destination: 'New York', duration_days: 4, interests: { food: [], sports: [], culture: [], general: [] }, completeness: 0.60 });
  assert.match(q3.question, /nelerden hoşlanırsın/);
  assert.equal(q3.quickOptions.some(o => o.label.includes('Kahve')), true);

  // Case 4: More than 7 days asks for division
  const q4 = planning.generateConciergeQuestion({ destination: 'New York', duration_days: 10, interests: { food: ['kahve'], sports: [], culture: [], general: [] }, completeness: 0.65 });
  assert.match(q4.question, /en fazla 7 gün/);
  assert.equal(q4.quickOptions.some(o => o.label.includes('Bölüm')), true);

  // Case 5: Ready for planning (completeness >= 0.70)
  const q5 = planning.generateConciergeQuestion({
    destination: 'New York',
    duration_days: 4,
    pace: 'relaxed',
    interests: { food: ['specialty_coffee'], sports: ['running'], culture: ['museums'], general: [] },
    completeness: 0.85
  });
  assert.match(q5.question, /taslağımız hazır/);
  assert.equal(q5.quickOptions.some(o => o.label.includes('Rotayı Hazırla')), true);
});

test('contextToProfile and profileToContext maintain bidirectional fidelity', () => {
  const legacyContext = {
    destination: 'Berlin',
    days: 3,
    interests: ['üçüncü dalga kahve', 'müzeler', 'koşu parkurları'],
    constraints: ['evcil hayvan dostu'],
    budget: 'mid'
  };

  const profile = planning.contextToProfile(legacyContext);
  assert.equal(profile.destination, 'Berlin');
  assert.equal(profile.duration_days, 3);
  assert.equal(profile.interests.food.includes('üçüncü dalga kahve'), true);
  assert.equal(profile.interests.culture.includes('müzeler'), true);
  assert.equal(profile.interests.sports.includes('koşu parkurları'), true);
  assert.equal(profile.completeness >= 0.70, true);

  const backContext = planning.profileToContext(profile);
  assert.equal(backContext.destination, legacyContext.destination);
  assert.equal(backContext.days, legacyContext.days);
  assert.equal(backContext.interests.length, legacyContext.interests.length);
  assert.deepEqual(backContext.constraints, legacyContext.constraints);
});
