import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const astroCliPath = fileURLToPath(
  new URL("../node_modules/astro/bin/astro.mjs", import.meta.url)
);
const result = spawnSync(
  process.execPath,
  [astroCliPath, ...process.argv.slice(2)],
  {
    env: {
      ...process.env,
      ASTRO_TELEMETRY_DISABLED: "1",
    },
    stdio: "inherit",
  }
);

if (result.error) {
  throw result.error;
}

if (result.signal) {
  try {
    process.kill(process.pid, result.signal);
  } catch {
    process.exitCode = 1;
  }
} else {
  process.exitCode = result.status ?? 1;
}
