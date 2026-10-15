// Defaults to a reviewable job request. --submit is the only paid operation.
const fs = require("node:fs"),
  crypto = require("node:crypto"),
  path = require("node:path");
const { execFileSync } = require("node:child_process");
function request(config, manifest) {
  if (config.region !== "us-east-1")
    throw Error("Pilot model region must be verified: expected us-east-1");
  if (
    !["amazon.nova-micro-v1:0:128k", "amazon.nova-lite-v1:0:300k"].includes(
      config.baseModelIdentifier,
    )
  )
    throw Error("Unsupported pilot model");
  for (const key of ["trainingS3Uri", "validationS3Uri", "outputS3Uri"])
    if (!/^s3:\/\/[^/]+\/.+/.test(config[key] || "")) throw Error(`Missing ${key}`);
  if (!/^arn:aws:iam::\d{12}:role\/.+/.test(config.roleArn || ""))
    throw Error("Scoped training role required");
  if (!/^arn:aws:kms:us-east-1:\d{12}:key\/.+/.test(config.kmsKeyArn || ""))
    throw Error("Training KMS key required");
  if (!config.datasetReviewed || !config.regionalProcessingReviewed || !config.budgetReviewed)
    throw Error("Dataset, region and budget review required");
  if (Object.values(manifest.splits || {}).reduce((n, s) => n + s.records, 0) < 2000)
    throw Error("Insufficient reviewed examples");
  return {
    jobName: config.jobName,
    customModelName: config.customModelName,
    roleArn: config.roleArn,
    baseModelIdentifier: config.baseModelIdentifier,
    customizationType: "FINE_TUNING",
    customModelKmsKeyId: config.kmsKeyArn,
    trainingDataConfig: { s3Uri: config.trainingS3Uri },
    validationDataConfig: { validators: [{ s3Uri: config.validationS3Uri }] },
    outputDataConfig: { s3Uri: config.outputS3Uri },
    hyperParameters: config.hyperParameters || {},
    clientRequestToken: crypto
      .createHash("sha256")
      .update(JSON.stringify([config, manifest]))
      .digest("hex"),
  };
}
function main() {
  const [configFile, datasetDir, ...flags] = process.argv.slice(2);
  const config = JSON.parse(fs.readFileSync(configFile)),
    manifest = JSON.parse(fs.readFileSync(path.join(datasetDir, "manifest.json")));
  for (const [split, data] of Object.entries(manifest.splits)) {
    const file = fs.readFileSync(path.join(datasetDir, `${split}.jsonl`));
    if (crypto.createHash("sha256").update(file).digest("hex") !== data.sha256)
      throw Error("Dataset changed after preparation");
  }
  const job = request(config, manifest),
    out = path.join(datasetDir, "job-request.json");
  fs.writeFileSync(out, JSON.stringify(job, null, 2) + "\n");
  if (flags.includes("--submit")) {
    for (const [split, uri] of [
      ["train", config.trainingS3Uri],
      ["validation", config.validationS3Uri],
    ])
      execFileSync(
        "aws",
        [
          "s3",
          "cp",
          path.join(datasetDir, `${split}.jsonl`),
          uri,
          "--sse",
          "aws:kms",
          "--sse-kms-key-id",
          config.kmsKeyArn,
          "--region",
          config.region,
        ],
        { stdio: "inherit" },
      );
    // Test split stays local and is never supplied to training.
    execFileSync(
      "aws",
      [
        "bedrock",
        "create-model-customization-job",
        "--region",
        config.region,
        "--cli-input-json",
        `file://${path.resolve(out)}`,
      ],
      { stdio: "inherit" },
    );
  } else console.log(`Prepared ${out}; no AWS operation executed.`);
}
module.exports = { request };
if (require.main === module) main();
