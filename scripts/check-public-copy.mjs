import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const distDirectory = path.resolve("dist");
const execFileAsync = promisify(execFile);

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
  const { stdout } = await execFileAsync("git", ["ls-files", "*.md"], {
    maxBuffer: 8 * 1024 * 1024,
  });

  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((file) => !file.startsWith("docs/plans/"));
};

const assertPublicCopy = (text, sourceLabel) => {
  if (/\bLite\b|datev-lite/i.test(text)) {
    throw new Error(`${sourceLabel} still contains legacy Lite naming.`);
  }
  if (/PLACEHOLDER/i.test(text)) {
    throw new Error(`${sourceLabel} contains placeholder text.`);
  }
};

const markdownFiles = await collectPublicMarkdownFiles();
for (const markdownFile of markdownFiles) {
  assertPublicCopy(await readFile(markdownFile, "utf8"), markdownFile);
}

const htmlFiles = await collectHtmlFiles(distDirectory);
if (htmlFiles.length === 0) {
  throw new Error("No built HTML files found in dist/.");
}

for (const htmlFile of htmlFiles) {
  assertPublicCopy(await readFile(htmlFile, "utf8"), htmlFile);
}
