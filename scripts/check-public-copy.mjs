import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const distDirectory = path.resolve("dist");
const execFileAsync = promisify(execFile);

const collectTrackedFiles = async (pathspecs) => {
  const { stdout } = await execFileAsync("git", ["ls-files", ...pathspecs], {
    maxBuffer: 8 * 1024 * 1024,
  });

  return stdout.split(/\r?\n/).filter(Boolean);
};

const collectHtmlFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectHtmlFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(entryPath);
    }
  }
  return files;
};

const collectPublicMarkdownFiles = async () => {
  return (await collectTrackedFiles(["*.md"])).filter(
    (file) => !file.startsWith("docs/plans/")
  );
};

const collectPublicSourceFiles = async () =>
  (
    await collectTrackedFiles(["*.ts", "*.tsx", "*.js", "*.mjs", "*.astro"])
  ).filter((file) => file !== "scripts/check-public-copy.mjs");

export const assertPublicCopy = (text, sourceLabel) => {
  if (/\bLite\b|datev-lite/i.test(text)) {
    throw new Error(`${sourceLabel} still contains legacy Lite naming.`);
  }
  if (/PLACEHOLDER/i.test(text)) {
    throw new Error(`${sourceLabel} contains placeholder text.`);
  }
  if (/\bMVP\b/.test(text)) {
    throw new Error(`${sourceLabel} contains outdated MVP wording.`);
  }
};

export const assertNoLegacySourceIdentifiers = (text, sourceLabel) => {
  if (/DatevLite|DATEV_LITE|datev-lite/.test(text)) {
    throw new Error(`${sourceLabel} still contains a legacy validator name.`);
  }
};

const main = async () => {
  const markdownFiles = await collectPublicMarkdownFiles();
  for (const markdownFile of markdownFiles) {
    assertPublicCopy(await readFile(markdownFile, "utf8"), markdownFile);
  }

  const sourceFiles = await collectPublicSourceFiles();
  for (const sourceFile of sourceFiles) {
    assertNoLegacySourceIdentifiers(
      await readFile(sourceFile, "utf8"),
      sourceFile
    );
  }

  const htmlFiles = await collectHtmlFiles(distDirectory);
  if (htmlFiles.length === 0) {
    throw new Error("No built HTML files found in dist/.");
  }

  for (const htmlFile of htmlFiles) {
    assertPublicCopy(await readFile(htmlFile, "utf8"), htmlFile);
  }
};

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
