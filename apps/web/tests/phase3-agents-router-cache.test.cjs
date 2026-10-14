const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

function loadModule(relativePath) {
  const ts = require('typescript');
  const fullPath = path.resolve(__dirname, '../app/lib/ai', relativePath);
  const code = fs.readFileSync(fullPath, 'utf8');
  const transformed = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const mod = { exports: {} };
  const customRequire = (spec) => {
    if (spec.startsWith('.')) {
      const resolved = path.resolve(path.dirname(fullPath), spec.endsWith('.ts') ? spec : spec + '.ts');
      if (fs.existsSync(resolved)) {
        return loadModule(path.relative(path.resolve(__dirname, '../app/lib/ai'), resolved));
      }
    }
    return require(spec);
  };
  const fn = new Function('require', 'exports', 'module', '__filename', '__dirname', transformed);
  fn(customRequire, mod.exports, mod, fullPath, path.dirname(fullPath));
  return mod.exports;
}

const router = loadModule('agent-router.ts');
const cacheMod = loadModule('cache-layer.ts');

test('routeSubAgents executes only relevant agents and skips unneeded ones (FinOps rule)', () => {
  // Scenario 1: Food-only interest
  const foodOnlyProfile = {
    interests: { food: ['nitelikli kahve'], sports: [], culture: [], general: [] },
    needs: { flights: false, car_rental: false, local_transit: false }
  };
  const decision1 = router.routeSubAgents('New York için kahve durakları öner', foodOnlyProfile);
  assert.equal(decision1.activeAgents.includes('food'), true);
  assert.equal(decision1.activeAgents.includes('sports'), false);
  assert.equal(decision1.activeAgents.includes('flights'), false);
  assert.equal(decision1.activeAgents.includes('car_rental'), false);
  assert.equal(typeof decision1.skippedAgents.sports, 'string');
  assert.equal(typeof decision1.skippedAgents.car_rental, 'string');

  // Scenario 2: Sports and flight interest
  const sportsFlightProfile = {
    interests: { food: [], sports: ['koşu', 'parkur'], culture: [], general: [] },
    needs: { flights: true, car_rental: false, local_transit: true }
  };
  const decision2 = router.routeSubAgents('Sabah koşusu parkuru ve havalimanı ulaşımı', sportsFlightProfile);
  assert.equal(decision2.activeAgents.includes('sports'), true);
  assert.equal(decision2.activeAgents.includes('flights'), true);
  assert.equal(decision2.activeAgents.includes('city_transit'), true);
  assert.equal(decision2.activeAgents.includes('car_rental'), false);

  // Scenario 3: Emergency prompt triggers emergency agent
  const emergencyDecision = router.routeSubAgents('Cüzdanımı ve pasaportumu kaybettim, en yakın polis veya hastane nerede?');
  assert.equal(emergencyDecision.activeAgents.includes('emergency'), true);
});

test('Multi-tier travelCache sets, gets, and respects TTL expiration', () => {
  const cache = cacheMod.travelCache;
  cache.clear();

  // Test default TTL constants
  assert.equal(cacheMod.CACHE_TTL_SECONDS.weather, 900); // 15 mins
  assert.equal(cacheMod.CACHE_TTL_SECONDS.pricing, 300); // 5 mins
  assert.equal(cacheMod.CACHE_TTL_SECONDS.places, 86400); // 24 hours
  assert.equal(cacheMod.CACHE_TTL_SECONDS.base_plan, 604800); // 7 days

  // Store weather
  cache.set('weather', { temp: 22, forecast: 'Güneşli' }, 900, 'New York', '2026-11-10');
  const storedWeather = cache.get('weather', 'New York', '2026-11-10');
  assert.deepEqual(storedWeather, { temp: 22, forecast: 'Güneşli' });

  // Store short-lived item and test expiration
  cache.set('pricing', { flightPrice: 450 }, -1, 'JFK', 'IST'); // expired 1s ago
  assert.equal(cache.get('pricing', 'JFK', 'IST'), null);

  // Invalidate single category
  cache.set('places', { place: 'Devoción' }, 86400, 'nyc', 'p_1');
  assert.equal(cache.has('places', 'nyc', 'p_1'), true);
  assert.equal(cache.has('weather', 'New York', '2026-11-10'), true);

  cache.invalidateCategory('weather');
  assert.equal(cache.has('weather', 'New York', '2026-11-10'), false);
  assert.equal(cache.has('places', 'nyc', 'p_1'), true);
});

test('Specialist sub-agents modules export expected runner functions and contracts', () => {
  const sports = loadModule('sub-agents/sports-agent.ts');
  const flight = loadModule('sub-agents/flight-agent.ts');
  const car = loadModule('sub-agents/car-rental-agent.ts');
  const transit = loadModule('sub-agents/city-transit-agent.ts');
  const intel = loadModule('sub-agents/city-intel-agent.ts');

  assert.equal(typeof sports.runSportsAgent, 'function');
  assert.equal(typeof flight.runFlightAgent, 'function');
  assert.equal(typeof car.runCarRentalAgent, 'function');
  assert.equal(typeof transit.runCityTransitAgent, 'function');
  assert.equal(typeof intel.runCityIntelAgent, 'function');
});
