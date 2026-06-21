const subject = process.env.CSV_VALIDATOR_COMMIT_SUBJECT ?? "";
const allowedTypes = [
  "feat",
  "fix",
  "refactor",
  "docs",
  "test",
  "chore",
  "ci",
  "build",
  "perf",
  "revert",
];
const pattern = new RegExp(
  `^(${allowedTypes.join("|")})(\\([a-z0-9-]+\\))?: [a-z0-9].{2,}$`
);

if (!pattern.test(subject)) {
  console.error(
    "Pull request title must follow Conventional Commits: <type>(<scope>): <description>"
  );
  process.exit(1);
}
