// Pull the restricted public browser key from SSM without logging credentials.
const fs = require("node:fs"),
  path = require("node:path");
const { SSMClient, GetParameterCommand } = require("../lambda/node_modules/@aws-sdk/client-ssm");
async function main() {
  const client = new SSMClient({ region: "eu-central-1" });
  const read = async (name) =>
    (
      await client.send(
        new GetParameterCommand({ Name: "/mapsbridge/prod/google/" + name, WithDecryption: true }),
      )
    ).Parameter?.Value || "";
  const [key, mapId] = await Promise.all([read("browser-key"), read("map-id")]);
  if (!/^AIza[\w-]{20,}$/.test(key) || !/^[-\w]{8,128}$/.test(mapId) || mapId === "DEMO_MAP_ID")
    throw Error("configuration");
  const file = path.resolve(__dirname, "../../apps/web/.env.local");
  let content = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  for (const [name, value] of Object.entries({
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: key,
    NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: mapId,
  })) {
    const pattern = new RegExp("^" + name + "=.*$", "m");
    content = pattern.test(content)
      ? content.replace(pattern, name + "=" + value)
      : content + "\n" + name + "=" + value + "\n";
  }
  fs.writeFileSync(file, content, { mode: 0o600 });
  console.log(
    "Google Maps build configuration updated. Build and verify API restrictions before publishing. No credentials printed.",
  );
}
main().catch(() => {
  console.error(
    "Google configuration unavailable. Supply the restricted Maps browser key and JavaScript map ID through the documented SSM parameters.",
  );
  process.exitCode = 1;
});
