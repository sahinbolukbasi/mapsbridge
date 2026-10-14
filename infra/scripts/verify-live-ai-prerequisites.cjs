const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const required = [
  ["AGENTCORE_MEMORY_ID", "AgentCore Memory isolation smoke test"],
  ["AGENTCORE_GATEWAY_URL", "AgentCore Gateway research smoke test"],
  ["AGENTCORE_PLACES_TOOL", "AgentCore Gateway tool selection"],
  ["BEDROCK_GUARDRAIL_ID", "Bedrock Guardrail block/allow smoke test"],
  ["BEDROCK_GUARDRAIL_VERSION", "Bedrock Guardrail version selection"]
];

const optional = [
  ["TRAVEL_KNOWLEDGE_BASE_ID", "Travel RAG smoke test"],
  ["AI_API_BASE_URL", "Authenticated API smoke tests"],
  ["COGNITO_USER_POOL_ID", "Temporary-user API smoke tests"],
  ["COGNITO_CLIENT_ID", "Temporary-user API smoke tests"]
];

function configured(name) {
  return typeof process.env[name] === "string" && process.env[name].trim().length > 0;
}

function readTerraformOutputHints() {
  const files = [
    path.resolve(__dirname, "../agentcore-gateway/terraform.tfstate"),
    path.resolve(__dirname, "../ai-memory/terraform.tfstate"),
    path.resolve(__dirname, "../travel-rag/terraform.tfstate")
  ];
  const hints = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    hints.push(path.basename(path.dirname(file)));
  }
  return hints;
}

function inspectTerraformOutputs() {
  const stacks = [
    ["agentcore-gateway", ["ai_gateway_environment"]],
    ["ai-memory", ["ai_environment", "guardrail_environment"]],
    ["travel-rag", ["knowledge_base_id"]]
  ];
  return stacks.map(([stack, expected]) => {
    const directory = path.resolve(__dirname, `../${stack}`);
    try {
      const raw = execFileSync("terraform", ["-chdir=" + directory, "output", "-json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      });
      const outputs = Object.keys(JSON.parse(raw));
      return {
        stack,
        stateAvailable: true,
        outputs,
        expected: expected.map((name) => ({ name, present: outputs.includes(name) }))
      };
    } catch {
      return { stack, stateAvailable: false, outputs: [], expected: expected.map((name) => ({ name, present: false })) };
    }
  });
}

function main() {
  const missing = required.filter(([name]) => !configured(name)).map(([name, purpose]) => ({ name, purpose }));
  const available = required.filter(([name]) => configured(name)).map(([name, purpose]) => ({ name, purpose }));
  const optionalStatus = optional.map(([name, purpose]) => ({ name, purpose, configured: configured(name) }));
  const result = {
    ok: missing.length === 0,
    liveSmokeTestsReady: missing.length === 0,
    required: { configured: available, missing },
    optional: optionalStatus,
    localTerraformStateHints: readTerraformOutputHints(),
    terraformOutputs: inspectTerraformOutputs(),
    nextSteps: missing.length
      ? [
          "Export smoke-test values from reviewed Terraform outputs; do not commit them.",
          "Run the read-only Gateway, Memory and Guardrail smoke tests separately.",
          "Record results under docs/verification/ without storing tokens, prompts or raw reasoning."
        ]
      : [
          "Run AgentCore Gateway smoke test.",
          "Run AgentCore Memory two-user isolation and purge smoke test.",
          "Run the Guardrail block/allow smoke test before enabling production traffic."
        ]
  };
  console.log(JSON.stringify(result, null, 2));
  if (missing.length) process.exitCode = 2;
}

if (require.main === module) main();
module.exports = { configured, readTerraformOutputHints };
