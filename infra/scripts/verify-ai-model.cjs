// Live Bedrock smoke test. Uses the AWS credential chain; prints no credentials.
const { buildSync } = require("../../apps/web/node_modules/esbuild");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const directory = mkdtempSync(path.join(tmpdir(), "mapsbridge-ai-"));
async function main() {
  process.env.BEDROCK_MODEL_ID ||= "eu.anthropic.claude-haiku-4-5-20251001-v1:0";
  process.env.AWS_REGION ||= "eu-central-1";
  process.env.PLACE_RESEARCH_ENABLED = "true";
  const outfile = path.join(directory, "supervisor.cjs");
  buildSync({
    entryPoints: [path.resolve(__dirname, "../../apps/web/app/lib/ai/supervisor.ts")],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    outfile,
  });
  const { runMultiAgentSupervisor } = require(outfile);
  const first = await runMultiAgentSupervisor({
    prompt:
      "Her seyahatimde tarih ve kültür duraklarını severim. İstanbul için 2 günlük bir gezi hazırla. Her gün iki durak yeterli.",
  });
  assert.equal(first.provider, "aws_bedrock");
  assert.ok(first.route);
  assert.equal(first.route.estimatedDays, 2);
  assert.ok(
    first.preferenceUpdates.interests?.includes("tarih") ||
      first.preferenceUpdates.travelStyle === "cultural",
  );
  console.log(
    JSON.stringify({
      scenario: "route-and-preferences",
      destination: first.route.destination,
      days: first.route.estimatedDays,
      preferences: first.preferenceUpdates,
    }),
  );
  const second = await runMultiAgentSupervisor({
    prompt: "Bu kez Roma için 1 gün planla. Önceki tercihlerimi dikkate al.",
    preferences: first.preferenceUpdates,
    conversationState: first.conversationState,
    conversationHistory: [
      { role: "user", content: "İstanbul için iki gün planla" },
      { role: "assistant", content: first.orchestratorSummary },
    ],
  });
  assert.ok(second.route);
  assert.match(second.route.destination, /roma|rome/i);
  assert.equal(second.route.estimatedDays, 1);
  console.log(
    JSON.stringify({
      scenario: "new-destination-with-memory",
      destination: second.route.destination,
      days: second.route.estimatedDays,
    }),
  );
  const clarification = await runMultiAgentSupervisor({
    prompt: "Bana bir gezi planı hazırlar mısın?",
  });
  assert.equal(clarification.route, undefined);
  assert.ok(clarification.orchestratorSummary);
  console.log(
    JSON.stringify({ scenario: "clarification", answer: clarification.orchestratorSummary }),
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => rmSync(directory, { recursive: true, force: true }));
