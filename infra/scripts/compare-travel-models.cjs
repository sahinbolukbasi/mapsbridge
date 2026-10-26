// Small live, reproducible Turkish intake benchmark. No user data or production changes.
const fs = require("node:fs");
const path = require("node:path");
const { buildSync } = require("esbuild");
const {
  BedrockRuntimeClient,
  ConverseCommand,
} = require("../lambda/node_modules/@aws-sdk/client-bedrock-runtime");
const out = "/tmp/mapsbridge-model-prompts.cjs";
buildSync({
  entryPoints: [path.resolve(__dirname, "../../apps/web/app/lib/ai/prompts.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: out,
});
const { INTAKE_PROMPT, INTAKE_SCHEMA } = require(out);
const cases = [
  { request: "selam", action: "chat" },
  { request: "Roma için rota yap", action: "clarify", destination: "Roma" },
  {
    request: "romada iki gun tarih ve kahve rotasi yap cok yurumek istemiyrum",
    action: "plan",
    destination: "Roma",
    days: 2,
  },
  {
    request: "iki gün, sakin olsun",
    action: "plan",
    days: 2,
    previousContext: {
      destination: "Roma",
      interests: [],
      constraints: [],
      planningRequested: true,
    },
    history: [
      { role: "user", content: [{ text: "Roma için rota yap" }] },
      { role: "assistant", content: [{ text: "Kaç gün ayıralım?" }] },
    ],
  },
  { request: "Roma değil Paris olsun, üç gün", action: "plan", destination: "Paris", days: 3 },
  { request: "Tokyo’da ne yenir? Rotamı değiştirme.", action: "chat" },
];
async function main() {
  const client = new BedrockRuntimeClient({ region: "eu-central-1", maxAttempts: 1 });
  const report = [];
  for (const model of (
    process.env.BENCH_MODELS ||
    "eu.amazon.nova-micro-v1:0,eu.amazon.nova-lite-v1:0,eu.amazon.nova-2-lite-v1:0,eu.anthropic.claude-haiku-4-5-20251001-v1:0"
  ).split(",")) {
    const rows = [];
    for (const c of cases) {
      const start = Date.now();
      try {
        const r = await client.send(
          new ConverseCommand({
            modelId: model,
            system: [{ text: INTAKE_PROMPT }],
            messages: [
              ...(c.history || []),
              {
                role: "user",
                content: [
                  {
                    text: JSON.stringify({
                      request: c.request,
                      previousContext: c.previousContext || { interests: [], constraints: [] },
                    }),
                  },
                ],
              },
            ],
            toolConfig: {
              tools: [
                {
                  toolSpec: {
                    name: "respond",
                    description: "Return structured response",
                    inputSchema: { json: INTAKE_SCHEMA },
                  },
                },
              ],
              toolChoice: { tool: { name: "respond" } },
            },
            inferenceConfig: { maxTokens: 1300, temperature: 0 },
          }),
          { abortSignal: AbortSignal.timeout(10000) },
        );
        const data = r.output?.message?.content?.find((b) => b.toolUse)?.toolUse.input;
        const negativeOK =
          !c.request.includes("istemiyrum") ||
          /istem|yürümek istem/i.test((data?.context?.constraints || []).join(" "));
        const passed =
          negativeOK &&
          data?.action === c.action &&
          (!c.days || data.context?.days === c.days) &&
          (!c.destination ||
            data.context?.destination?.toLowerCase().includes(c.destination.toLowerCase()));
        rows.push({
          request: c.request,
          passed: !!passed,
          ms: Date.now() - start,
          usage: r.usage,
          data,
        });
      } catch (e) {
        rows.push({
          request: c.request,
          passed: false,
          ms: Date.now() - start,
          error: e.name,
          message: e.message,
        });
        if (["AccessDeniedException", "ValidationException"].includes(e.name)) break;
      }
    }
    const summary = {
      model,
      passed: rows.filter((r) => r.passed).length,
      total: cases.length,
      rows,
    };
    report.push(summary);
    console.log(JSON.stringify(summary));
  }
  fs.writeFileSync(
    path.resolve(__dirname, "../../docs/verification/model-selection-2026-10-05.json"),
    JSON.stringify(report, null, 2),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
