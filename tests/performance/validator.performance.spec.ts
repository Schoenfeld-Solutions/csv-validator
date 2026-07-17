import { expect, test, type Page } from "@playwright/test";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { availableParallelism, totalmem } from "node:os";
import { join } from "node:path";
import { performance as nodePerformance } from "node:perf_hooks";

import { syntheticSizedGlAccountDescriptionCsv } from "../unit/datev-test-fixtures";

const MEBIBYTE = 1_024 * 1_024;
const HEARTBEAT_INTERVAL_MILLISECONDS = 10;
const DEFAULT_REPETITIONS = 10;
const TARGET_SIZES = [MEBIBYTE, 5 * MEBIBYTE, 10 * MEBIBYTE - 1_024];
const REPORT_DIRECTORY = ".local/performance-baseline";
const REPORT_PATH = `${REPORT_DIRECTORY}/report.json`;

interface HeartbeatState {
  lastAt: number;
  maximumGapMilliseconds: number;
  tickCount: number;
}

interface Measurement {
  readonly actualBytes: number;
  readonly dataRecordCount: number;
  readonly durationMilliseconds: number;
  readonly heartbeatMaximumGapMilliseconds: number;
  readonly heartbeatTickCount: number;
  readonly targetBytes: number;
}

declare global {
  interface Window {
    __csvValidatorPerformanceHeartbeat?: HeartbeatState;
  }
}

const repetitions = (): number => {
  const raw = process.env.CSV_VALIDATOR_PERFORMANCE_RUNS;
  const parsed = raw === undefined ? DEFAULT_REPETITIONS : Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new Error(
      "CSV_VALIDATOR_PERFORMANCE_RUNS must be an integer from 1 through 100"
    );
  }
  return parsed;
};

const installHeartbeat = async (page: Page): Promise<void> => {
  await page.addInitScript((intervalMilliseconds) => {
    const state: HeartbeatState = {
      lastAt: performance.now(),
      maximumGapMilliseconds: 0,
      tickCount: 0,
    };
    window.__csvValidatorPerformanceHeartbeat = state;
    window.setInterval(() => {
      const now = performance.now();
      state.maximumGapMilliseconds = Math.max(
        state.maximumGapMilliseconds,
        now - state.lastAt
      );
      state.lastAt = now;
      state.tickCount += 1;
    }, intervalMilliseconds);
  }, HEARTBEAT_INTERVAL_MILLISECONDS);
};

const resetHeartbeat = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const state = window.__csvValidatorPerformanceHeartbeat;
    if (!state) throw new Error("Performance heartbeat is unavailable");
    state.lastAt = performance.now();
    state.maximumGapMilliseconds = 0;
    state.tickCount = 0;
  });

const readHeartbeat = (page: Page): Promise<HeartbeatState> =>
  page.evaluate(() => {
    const state = window.__csvValidatorPerformanceHeartbeat;
    if (!state) throw new Error("Performance heartbeat is unavailable");
    return { ...state };
  });

const round = (value: number): number => Math.round(value * 100) / 100;

const percentile = (values: readonly number[], ratio: number): number => {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) throw new Error("Cannot summarize no measurements");
  const position = (sorted.length - 1) * ratio;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sorted[lowerIndex];
  const upper = sorted[upperIndex];
  if (lower === undefined || upper === undefined) {
    throw new Error("Measurement percentile index is unavailable");
  }
  return lower + (upper - lower) * (position - lowerIndex);
};

const summarize = (values: readonly number[]) => ({
  maximum: round(Math.max(...values)),
  median: round(percentile(values, 0.5)),
  minimum: round(Math.min(...values)),
  p95: round(percentile(values, 0.95)),
});

const collectBuildSizes = async () => {
  const assetDirectory = join(process.cwd(), "dist", "_astro");
  const entries = await readdir(assetDirectory, { withFileTypes: true });
  const javascriptAssets = entries.filter(
    (entry) => entry.isFile() && entry.name.endsWith(".js")
  );
  const sizes = await Promise.all(
    javascriptAssets.map(async (entry) => ({
      bytes: (await stat(join(assetDirectory, entry.name))).size,
      isWorker: entry.name.startsWith("validator.worker-"),
    }))
  );
  const totalJavaScriptBytes = sizes.reduce(
    (total, asset) => total + asset.bytes,
    0
  );
  const workerJavaScriptBytes = sizes
    .filter((asset) => asset.isWorker)
    .reduce((total, asset) => total + asset.bytes, 0);
  const workerJavaScriptAssetCount = sizes.filter(
    (asset) => asset.isWorker
  ).length;
  return {
    applicationJavaScriptBytes: totalJavaScriptBytes - workerJavaScriptBytes,
    javascriptAssetCount: sizes.length,
    totalJavaScriptBytes,
    workerJavaScriptAssetCount,
    workerJavaScriptBytes,
  };
};

test("records the local maximum-size browser baseline", async ({
  browserName,
  page,
}) => {
  const runCount = repetitions();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await installHeartbeat(page);
  await page.goto("/csv-validator/en/");
  const fileInput = page.locator("#fileInput");
  const statusLine = page.locator("#statusLine");

  const warmup = syntheticSizedGlAccountDescriptionCsv(64 * 1_024);
  await fileInput.setInputFiles({
    buffer: Buffer.from(warmup.content, "utf8"),
    mimeType: "text/csv",
    name: "performance-warmup.csv",
  });
  await expect(statusLine).toHaveText(
    "performance-warmup.csv processed locally in the browser."
  );

  const measurements: Measurement[] = [];
  for (const targetBytes of TARGET_SIZES) {
    const fixture = syntheticSizedGlAccountDescriptionCsv(targetBytes);
    const fixtureBuffer = Buffer.from(fixture.content, "utf8");
    for (let runIndex = 0; runIndex < runCount; runIndex += 1) {
      const fileName = `performance-${targetBytes}-${runIndex + 1}.csv`;
      await resetHeartbeat(page);
      const startedAt = nodePerformance.now();
      await fileInput.setInputFiles({
        buffer: fixtureBuffer,
        mimeType: "text/csv",
        name: fileName,
      });
      await expect(statusLine).toHaveText(
        `${fileName} processed locally in the browser.`
      );
      const durationMilliseconds = nodePerformance.now() - startedAt;
      const heartbeat = await readHeartbeat(page);

      await expect(page.locator("#resultBadge")).toHaveText("Valid");
      await expect(page.locator("#metaRecognition")).toHaveText(
        "datev-gl-account-description-v3"
      );
      await expect(page.locator("#metaDataRows")).toHaveText(
        String(fixture.dataRecordCount)
      );
      await expect(page.locator("#metaRows")).toHaveText(
        String(fixture.dataRecordCount + 2)
      );
      await expect(page.locator("#metaFields")).toHaveText("4");

      measurements.push({
        actualBytes: fixture.sizeBytes,
        dataRecordCount: fixture.dataRecordCount,
        durationMilliseconds: round(durationMilliseconds),
        heartbeatMaximumGapMilliseconds: round(
          heartbeat.maximumGapMilliseconds
        ),
        heartbeatTickCount: heartbeat.tickCount,
        targetBytes,
      });
    }
  }

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(
    measurements
      .filter((measurement) => measurement.targetBytes === TARGET_SIZES[2])
      .every((measurement) => measurement.heartbeatTickCount > 0)
  ).toBe(true);

  const build = await collectBuildSizes();
  expect(build.javascriptAssetCount).toBeGreaterThan(0);
  expect(build.workerJavaScriptAssetCount).toBeGreaterThan(0);
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    methodology: {
      heartbeatIntervalMilliseconds: HEARTBEAT_INTERVAL_MILLISECONDS,
      repetitionsPerSize: runCount,
      thresholdPolicy: "advisory-baseline-only",
      warmupRuns: 1,
    },
    environment: {
      architecture: process.arch,
      browserName,
      browserVersion: page.context().browser()?.version() ?? "unknown",
      logicalCpuCount: availableParallelism(),
      nodeVersion: process.version,
      platform: process.platform,
      totalMemoryBytes: totalmem(),
    },
    build,
    results: TARGET_SIZES.map((targetBytes) => {
      const matching = measurements.filter(
        (measurement) => measurement.targetBytes === targetBytes
      );
      const first = matching[0];
      if (!first) throw new Error("Missing performance measurements");
      return {
        actualBytes: first.actualBytes,
        dataRecordCount: first.dataRecordCount,
        durationMilliseconds: summarize(
          matching.map((measurement) => measurement.durationMilliseconds)
        ),
        heartbeatMaximumGapMilliseconds: summarize(
          matching.map(
            (measurement) => measurement.heartbeatMaximumGapMilliseconds
          )
        ),
        heartbeatTickCount: summarize(
          matching.map((measurement) => measurement.heartbeatTickCount)
        ),
        targetBytes,
      };
    }),
  };

  expect(JSON.stringify(report)).not.toContain("Synthetic performance row");
  await mkdir(REPORT_DIRECTORY, { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Performance baseline written to ${REPORT_PATH}`);
});
