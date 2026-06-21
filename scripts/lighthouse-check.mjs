import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const urls = [
  "http://127.0.0.1:4322/csv-validator/de/",
  "http://127.0.0.1:4322/csv-validator/en/",
];
const chromePath = chromium.executablePath();
const thresholds = {
  accessibility: 1,
  "best-practices": 1,
  performance: 1,
  seo: 1,
};

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

const preview = spawn(
  "npm",
  ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4322"],
  {
    stdio: "ignore",
  }
);

const stopPreview = () => {
  if (!preview.killed) {
    preview.kill("SIGTERM");
  }
};

try {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(urls[0]);
      if (response.ok) break;
    } catch {
      // Server is not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  for (const [index, url] of urls.entries()) {
    const { stdout } = await run(
      "npx",
      [
        "lighthouse",
        url,
        "--quiet",
        "--output=json",
        "--hostname=127.0.0.1",
        `--port=${9223 + index}`,
        "--chrome-flags=--headless=new --no-sandbox",
      ],
      {
        env: { ...process.env, CHROME_PATH: chromePath },
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
  stopPreview();
}
