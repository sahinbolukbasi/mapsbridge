// TS modüllerini (relative import'larıyla birlikte) test içinde yükler (design §0 Teknoloji kilidi).
//   loadTs(entryAbsPath, { stubs?: Record<absPath, stubAbsPath>, globals?: object }) → module.exports
// esbuild bundle (cjs, node22) + vm. `stubs`, esbuild onResolve plugin'iyle çözülen mutlak yolu
// stub modüle yönlendirir. esbuild'in senkron API'si plugin desteklemediği için stub'lı yükleme
// aynı ayarlarla async build'i bir alt süreçte koşar (çağıran için API yine senkrondur).
// `globals` vm bağlamına eklenir; window/localStorage yoktur (yükleme anında erişim bilinçli hatadır).
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");
const esbuild = require("esbuild");

const BUILD_OPTIONS = {
  bundle: true,
  write: false,
  format: "cjs",
  platform: "node",
  target: "node22",
  logLevel: "silent",
};

function normalizeStubs(stubs) {
  const out = {};
  for (const [from, to] of Object.entries(stubs)) {
    const target = path.resolve(to);
    if (!fs.existsSync(target)) throw new Error(`loadTs: stub hedefi yok: ${target}`);
    // esbuild gerçek yolu görür (macOS /tmp → /private/tmp); anahtarlar gerçek yola çevrilir.
    const key = path.resolve(from);
    out[fs.existsSync(key) ? fs.realpathSync(key) : key] = fs.realpathSync(target);
  }
  return out;
}

// Alt süreçte koşan, plugin'li bundle betiği (stdin: {entry, stubs, options}).
const CHILD = `
const esbuild = require(${JSON.stringify(require.resolve("esbuild"))});
const path = require("node:path");
const fs = require("node:fs");
let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", async () => {
  const { entry, stubs, options } = JSON.parse(input);
  const exts = ["", ".ts", ".tsx", ".js", ".cjs", ".mjs", "/index.ts", "/index.tsx", "/index.js"];
  const resolveFile = (p) => {
    const hit = exts.map((e) => p + e).find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
    return hit && fs.realpathSync(hit);
  };
  const plugin = {
    name: "load-ts-stubs",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (!args.path.startsWith(".") && !path.isAbsolute(args.path)) return undefined;
        const abs = resolveFile(path.resolve(args.resolveDir, args.path));
        if (abs && stubs[abs]) return { path: stubs[abs] };
        const noExt = abs && abs.replace(/\\.(ts|tsx|js|cjs|mjs)$/, "");
        for (const [from, to] of Object.entries(stubs)) {
          if (from === abs || from === noExt) return { path: to };
        }
        return undefined;
      });
    },
  };
  try {
    const r = await esbuild.build({ ...options, entryPoints: [entry], plugins: [plugin] });
    process.stdout.write(r.outputFiles[0].text);
  } catch (err) {
    process.stderr.write(String(err && err.message ? err.message : err));
    process.exit(1);
  }
});
`;

function bundle(entry, stubs) {
  if (!stubs || Object.keys(stubs).length === 0) {
    return esbuild.buildSync({ ...BUILD_OPTIONS, entryPoints: [entry] }).outputFiles[0].text;
  }
  const r = spawnSync(process.execPath, ["-e", CHILD], {
    input: JSON.stringify({ entry, stubs, options: BUILD_OPTIONS }),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`loadTs: bundle başarısız (${entry}): ${r.stderr}`);
  return r.stdout;
}

function loadTs(entryAbsPath, { stubs = {}, globals = {} } = {}) {
  const entry = path.resolve(entryAbsPath);
  if (!fs.existsSync(entry)) throw new Error(`loadTs: dosya yok: ${entry}`);
  const code = bundle(entry, normalizeStubs(stubs));
  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    require,
    console,
    process,
    Buffer,
    setTimeout,
    clearTimeout,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    crypto: globalThis.crypto,
    ...globals,
  });
  vm.runInContext(code, context, { filename: entry });
  return module.exports;
}

module.exports = { loadTs };
