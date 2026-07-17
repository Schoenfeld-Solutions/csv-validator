import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const errors = [];
const expectedNodeVersion = "26.5.0";
const expectedNodeEngine = ">=26.0.0 <27";
const expectedNpmVersion = "11.9.0";

const requiredFiles = [
  "AGENTS.md",
  "CONTRIBUTING.md",
  "NOTICE.md",
  "README.md",
  "SECURITY.md",
  ".github/dependabot.yml",
  ".github/pull_request_template.md",
  ".github/workflows/dependency-audit.yml",
  ".github/workflows/pages.yml",
  ".github/workflows/pull-request.yml",
  "docs/contracts/datev-validator-result-v1.md",
  "docs/ops/release-readiness.md",
  "docs/ops/repository-governance.md",
];

const readText = async (path) => readFile(path, "utf8");

const requireFile = async (path) => {
  try {
    await access(path);
  } catch {
    errors.push(`Missing required governance file: ${path}`);
  }
};

const requireSnippet = (path, text, snippet) => {
  if (!text.includes(snippet)) {
    errors.push(`${path} is missing required snippet: ${snippet}`);
  }
};

const forbidSnippet = (path, text, snippet) => {
  if (text.includes(snippet)) {
    errors.push(`${path} must not contain: ${snippet}`);
  }
};

const workflowJobNames = (workflowText) =>
  [...workflowText.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)].map(
    (match) => match[1]
  );

const validateWorkflowBasics = (path, text) => {
  requireSnippet(path, text, "permissions:");
  requireSnippet(path, text, "concurrency:");
  forbidSnippet(path, text, "pull_request_target:");

  for (const jobName of workflowJobNames(text)) {
    const jobStart = text.indexOf(`  ${jobName}:\n`);
    const nextJobMatch = text
      .slice(jobStart + jobName.length + 5)
      .match(/\n {2}[A-Za-z0-9_-]+:\s*\n/);
    const jobEnd =
      nextJobMatch === null
        ? text.length
        : jobStart + jobName.length + 5 + nextJobMatch.index;
    const jobBlock = text.slice(jobStart, jobEnd);
    if (
      jobBlock.includes("runs-on:") &&
      !jobBlock.includes("timeout-minutes:")
    ) {
      errors.push(`${path} job ${jobName} is missing timeout-minutes`);
    }
  }
};

const validatePullRequestWorkflow = async () => {
  const path = ".github/workflows/pull-request.yml";
  const text = await readText(path);
  validateWorkflowBasics(path, text);
  for (const snippet of [
    "pull_request:",
    "branches:\n      - main",
    "contents: read",
    "pull-requests: read",
    "validate-pr-title:",
    "dependency-review:",
    "quality:",
    "name: Preflight",
    "needs: [validate-pr-title, dependency-review]",
    "node-version-file: .node-version",
    "run: npm ci",
    "run: npx playwright install --with-deps chromium",
    "run: npm run preflight",
    "run: git diff --check",
  ]) {
    requireSnippet(path, text, snippet);
  }
};

const validatePagesWorkflow = async () => {
  const path = ".github/workflows/pages.yml";
  const text = await readText(path);
  validateWorkflowBasics(path, text);
  for (const snippet of [
    "push:",
    "branches:\n      - main",
    "workflow_dispatch:",
    "contents: read",
    "name: Preflight",
    "needs: [quality]",
    "actions/configure-pages@v6",
    "actions/upload-pages-artifact@v5",
    "actions/deploy-pages@v5",
    "continue-on-error: true",
    "Wait before retrying GitHub Pages deployment",
    "Retry GitHub Pages deployment",
    "id: deployment_retry",
    "if: steps.deployment.outcome == 'failure'",
    "Wait before final GitHub Pages deployment retry",
    "Final GitHub Pages deployment retry",
    "id: deployment_retry_final",
    "if: steps.deployment_retry.outcome == 'failure'",
    "if: github.ref == 'refs/heads/main'",
    "id-token: write",
    "pages: write",
    "environment:",
    "steps.deployment.outputs.page_url || steps.deployment_retry.outputs.page_url",
    "steps.deployment_retry_final.outputs.page_url",
    "github-pages",
  ]) {
    requireSnippet(path, text, snippet);
  }
};

const validateDependencyAuditWorkflow = async () => {
  const path = ".github/workflows/dependency-audit.yml";
  const text = await readText(path);
  validateWorkflowBasics(path, text);
  for (const snippet of [
    "workflow_dispatch:",
    "contents: read",
    "pull-requests: read",
    "name: Dependency Audit",
    "node-version-file: .node-version",
    "run: test -f package-lock.json",
    "run: npm ci",
    "run: npm run audit:ci",
  ]) {
    requireSnippet(path, text, snippet);
  }
};

const validateRuntimeBaseline = async () => {
  const nodeVersion = (await readText(".node-version")).trim();
  const packageJson = JSON.parse(await readText("package.json"));

  if (nodeVersion !== expectedNodeVersion) {
    errors.push(
      `.node-version must be ${expectedNodeVersion}, received ${nodeVersion}`
    );
  }
  if (packageJson.engines?.node !== expectedNodeEngine) {
    errors.push(`package.json engines.node must be ${expectedNodeEngine}`);
  }
  if (packageJson.volta?.node !== expectedNodeVersion) {
    errors.push(`package.json volta.node must be ${expectedNodeVersion}`);
  }
  if (packageJson.volta?.npm !== expectedNpmVersion) {
    errors.push(`package.json volta.npm must be ${expectedNpmVersion}`);
  }
  if (packageJson.packageManager !== `npm@${expectedNpmVersion}`) {
    errors.push(
      `package.json packageManager must be npm@${expectedNpmVersion}`
    );
  }

  for (const documentationPath of [
    "AGENTS.md",
    "CONTRIBUTING.md",
    "README.md",
  ]) {
    requireSnippet(
      documentationPath,
      await readText(documentationPath),
      `Node.js \`${expectedNodeVersion}\``
    );
  }
};

const validateDependabot = async () => {
  const path = ".github/dependabot.yml";
  const text = await readText(path);
  for (const snippet of [
    "version: 2",
    'package-ecosystem: "github-actions"',
    'package-ecosystem: "npm"',
    'interval: "weekly"',
    'timezone: "Europe/Berlin"',
    "open-pull-requests-limit: 1",
    'rebase-strategy: "disabled"',
    "github-actions-rollup:",
    "npm-rollup:",
    "version-update:semver-major",
  ]) {
    requireSnippet(path, text, snippet);
  }
};

const validateIgnores = async () => {
  const gitignore = await readText(".gitignore");
  const prettierignore = await readText(".prettierignore");
  requireSnippet(".gitignore", gitignore, ".local/");
  requireSnippet(".gitignore", gitignore, "docs/plans/");
  requireSnippet(".prettierignore", prettierignore, ".local");
  requireSnippet(".prettierignore", prettierignore, "docs/plans");
};

const validatePackageScripts = async () => {
  const path = "package.json";
  const packageJson = JSON.parse(await readText(path));
  const scripts = packageJson.scripts ?? {};
  for (const [scriptName, expectedCommand] of Object.entries({
    "audit:ci": "npm audit --audit-level=low",
    "check:governance": "node scripts/check-repo-governance.mjs",
    "check:public-copy": "node scripts/check-public-copy.mjs",
    "check:pr-title": "node scripts/check-pr-title.mjs",
    preflight: "bash bin/checks/preflight.sh",
    "test:e2e": "playwright test",
    "test:lighthouse": "node scripts/lighthouse-check.mjs",
  })) {
    if (scripts[scriptName] !== expectedCommand) {
      errors.push(
        `${path} script ${scriptName} must be ${JSON.stringify(
          expectedCommand
        )}`
      );
    }
  }
};

const validatePreflight = async () => {
  const path = "bin/checks/preflight.sh";
  const text = await readText(path);
  requireSnippet(path, text, "npm run check:governance");
  requireSnippet(path, text, "npm run audit:ci");
  requireSnippet(path, text, "npm run check:public-copy");
  requireSnippet(path, text, "npm run test:coverage");
  requireSnippet(path, text, "npm run test:e2e");
  requireSnippet(path, text, "npm run test:lighthouse");
};

const validateDocumentation = async () => {
  const agents = await readText("AGENTS.md");
  for (const snippet of [
    "main",
    "dev/<topic>",
    "Human Merge",
    ".local/",
    "DATEV",
    "src/lib/datev/",
    "npm run preflight",
  ]) {
    requireSnippet("AGENTS.md", agents, snippet);
  }

  const governance = await readText("docs/ops/repository-governance.md");
  for (const snippet of [
    "Protect main",
    "validate-pr-title",
    "Preflight",
    "no bypass actors",
    "required_approving_review_count: 0",
  ]) {
    requireSnippet("docs/ops/repository-governance.md", governance, snippet);
  }

  const release = await readText("docs/ops/release-readiness.md");
  for (const snippet of [
    "npm run preflight",
    "git diff --check",
    "git ls-files .local docs/plans",
    "squash merge",
    "fast-forward",
  ]) {
    requireSnippet("docs/ops/release-readiness.md", release, snippet);
  }
};

const validateMarkdownLanguage = async () => {
  const { stdout } = await execFileAsync("git", ["ls-files", "*.md"], {
    maxBuffer: 8 * 1024 * 1024,
  });
  const trackedMarkdownFiles = stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((path) => !path.startsWith("docs/plans/"));

  const unclearValidationTermPattern = new RegExp(
    `\\b${["black", "box"].join("")}\\b`,
    "i"
  );
  const forbiddenMarkdownPatterns = [
    {
      pattern:
        /\b(und|oder|fuer|keine|muss|muessen|Datenschutz|Impressum|Haftung)\b/i,
      reason: "German repository prose",
    },
    {
      pattern: unclearValidationTermPattern,
      reason: "unclear legacy validation terminology",
    },
  ];

  for (const path of trackedMarkdownFiles) {
    const text = await readText(path);
    for (const { pattern, reason } of forbiddenMarkdownPatterns) {
      if (pattern.test(text)) {
        errors.push(`${path} contains ${reason}`);
      }
    }
  }
};

const validateTrackedTextContent = async () => {
  const { stdout } = await execFileAsync("git", ["ls-files"], {
    maxBuffer: 8 * 1024 * 1024,
  });
  const trackedTextFiles = stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((path) => !path.startsWith("docs/plans/"))
    .filter((path) => !path.startsWith(".local/"))
    .filter((path) =>
      /\.(astro|css|html|js|json|md|mjs|sh|ts|tsx|yml|yaml)$/i.test(path)
    )
    .filter((path) => path !== "package-lock.json");

  const internalRepositoryNamePattern = new RegExp(
    ["com", "datev", "validator"].join("\\."),
    "i"
  );
  const unclearValidationTermPattern = new RegExp(
    `\\b${["black", "box"].join("")}\\b`,
    "i"
  );
  const forbiddenTextPatterns = [
    {
      pattern: /\/Users\/[^/\s"'`<>()]+\/Repositories\/[^/\s"'`<>()]+/i,
      reason: "local absolute repository path",
    },
    {
      pattern: internalRepositoryNamePattern,
      reason: "internal reference repository name",
    },
    {
      pattern: unclearValidationTermPattern,
      reason: "unclear legacy validation terminology",
    },
  ];

  for (const path of trackedTextFiles) {
    const text = await readText(path);
    for (const { pattern, reason } of forbiddenTextPatterns) {
      if (pattern.test(text)) {
        errors.push(`${path} contains ${reason}`);
      }
    }
  }
};

const validateTrackedFiles = async () => {
  const { stdout } = await execFileAsync("git", ["ls-files"], {
    maxBuffer: 8 * 1024 * 1024,
  });
  const trackedFiles = stdout.split(/\r?\n/).filter(Boolean);
  const trackedLocalFiles = trackedFiles.filter((path) =>
    path.startsWith(".local/")
  );
  if (trackedLocalFiles.length > 0) {
    errors.push(
      `.local files must not be tracked: ${trackedLocalFiles.join(", ")}`
    );
  }
  const trackedPlanFiles = trackedFiles.filter((path) =>
    path.startsWith("docs/plans/")
  );
  if (trackedPlanFiles.length > 0) {
    errors.push(
      `Local planning files must not be tracked: ${trackedPlanFiles.join(", ")}`
    );
  }

  const forbiddenPatterns = [
    /Musterdaten_DATEV/i,
    /datev-musterdaten/i,
    /\.(exe|zip)$/i,
    /DATEV.*\.(html|xml)$/i,
    /\.(datev-validator-report\.json)$/i,
  ];
  const forbiddenFiles = trackedFiles.filter((path) =>
    forbiddenPatterns.some((pattern) => pattern.test(path))
  );
  if (forbiddenFiles.length > 0) {
    errors.push(
      `Forbidden local or official DATEV artifacts are tracked: ${forbiddenFiles.join(", ")}`
    );
  }
};

for (const path of requiredFiles) {
  await requireFile(path);
}

await validatePullRequestWorkflow();
await validatePagesWorkflow();
await validateDependencyAuditWorkflow();
await validateDependabot();
await validateIgnores();
await validateRuntimeBaseline();
await validatePackageScripts();
await validatePreflight();
await validateDocumentation();
await validateMarkdownLanguage();
await validateTrackedTextContent();
await validateTrackedFiles();

if (errors.length > 0) {
  console.error("Repository governance check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Repository governance check passed.");
