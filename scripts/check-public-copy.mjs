import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const distDirectory = path.resolve("dist");

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

const htmlFiles = await collectHtmlFiles(distDirectory);
if (htmlFiles.length === 0) {
  throw new Error("No built HTML files found in dist/.");
}

for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, "utf8");
  if (/\bLite\b|datev-lite/i.test(html)) {
    throw new Error(
      `Built HTML still contains legacy Lite naming: ${htmlFile}`
    );
  }
  if (/PLACEHOLDER/i.test(html)) {
    throw new Error(`Built HTML contains placeholder text: ${htmlFile}`);
  }
}
