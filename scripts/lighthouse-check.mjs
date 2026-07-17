import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const chromePath = chromium.executablePath();
const thresholds = {
  accessibility: 1,
  "best-practices": 1,
  performance: 1,
  seo: 1,
};

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const findAvailablePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a local Lighthouse port."));
        return;
      }
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed:\n${stderr}`));
      }
    });
  });

const summarizeCategoryFailures = (category, audits) => {
  const auditReferences = category.auditRefs ?? [];
  return auditReferences
    .map((auditReference) => audits[auditReference.id])
    .filter(
      (audit) =>
        audit &&
        audit.scoreDisplayMode !== "notApplicable" &&
        audit.scoreDisplayMode !== "manual" &&
        audit.score !== null &&
        audit.score < 1
    )
    .map(
      (audit) =>
        `${audit.id}: ${audit.score} (${audit.title ?? "untitled audit"})`
    )
    .slice(0, 10);
};

const previewPort = await findAvailablePort();
const urls = [
  `http://127.0.0.1:${previewPort}/csv-validator/de/`,
  `http://127.0.0.1:${previewPort}/csv-validator/en/`,
];
const astroCliPath = fileURLToPath(
  new URL("../node_modules/astro/bin/astro.mjs", import.meta.url)
);
const preview = spawn(
  process.execPath,
  [
    astroCliPath,
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(previewPort),
  ],
  {
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "ignore", "pipe"],
  }
);
let previewStderr = "";
preview.stderr.on("data", (chunk) => {
  previewStderr = `${previewStderr}${chunk.toString()}`.slice(-4_000);
});

const stopPreview = async () => {
  if (preview.exitCode !== null || preview.signalCode !== null) return;
  preview.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => preview.once("close", resolve)),
    delay(5_000),
  ]);
  if (preview.exitCode === null && preview.signalCode === null) {
    preview.kill("SIGKILL");
  }
};

try {
  let previewReady = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (preview.exitCode !== null || preview.signalCode !== null) {
      throw new Error(
        `Astro preview exited before Lighthouse could start.\n${previewStderr}`
      );
    }
    try {
      const response = await fetch(urls[0]);
      if (response.ok) {
        previewReady = true;
        break;
      }
    } catch {
      // Server is not ready yet.
    }
    await delay(500);
  }
  if (!previewReady) {
    throw new Error(
      `Astro preview did not become ready for Lighthouse.\n${previewStderr}`
    );
  }

  for (const url of urls) {
    const lighthousePort = await findAvailablePort();
    const { stdout } = await run(
      "npx",
      [
        "lighthouse",
        url,
        "--quiet",
        "--output=json",
        "--hostname=127.0.0.1",
        `--port=${lighthousePort}`,
        "--chrome-flags=--headless --no-sandbox",
      ],
      {
        env: { ...process.env, CHROME_PATH: chromePath },
        timeout: 120_000,
      }
    );
    const report = JSON.parse(stdout);
    const categories = report.categories ?? {};
    const audits = report.audits ?? {};
    for (const [category, threshold] of Object.entries(thresholds)) {
      const categoryReport = categories[category];
      const score = categoryReport?.score;
      if (score !== threshold) {
        const failures =
          categoryReport === undefined
            ? []
            : summarizeCategoryFailures(categoryReport, audits);
        throw new Error(
          [
            `Lighthouse ${category} score ${score ?? "missing"} did not equal ${threshold} for ${url}`,
            ...failures,
          ].join("\n")
        );
      }
    }
  }
} finally {
  await stopPreview();
}
