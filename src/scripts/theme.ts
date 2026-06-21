const themeToggle = document.getElementById("themeToggle");
const systemThemeQuery =
  typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : undefined;

type Theme = "dark" | "light";

const getStoredTheme = (): Theme | undefined => {
  try {
    const savedTheme = localStorage.getItem("csv-validator-theme");
    return savedTheme === "dark" || savedTheme === "light"
      ? savedTheme
      : undefined;
  } catch {
    return undefined;
  }
};

const getSystemTheme = (): Theme =>
  systemThemeQuery?.matches === true ? "dark" : "light";

const getEffectiveTheme = (): Theme => {
  const currentTheme = document.documentElement.dataset.theme;
  return currentTheme === "dark" || currentTheme === "light"
    ? currentTheme
    : (getStoredTheme() ?? getSystemTheme());
};

const applyTheme = (theme: Theme, source: "fallback" | "saved" | "system") => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themeSource = source;
};

const updateThemeState = (): void => {
  if (!(themeToggle instanceof HTMLButtonElement)) return;
  const dark = getEffectiveTheme() === "dark";
  themeToggle.setAttribute("aria-pressed", String(dark));
};

if (themeToggle instanceof HTMLButtonElement) {
  const storedTheme = getStoredTheme();
  applyTheme(storedTheme ?? getSystemTheme(), storedTheme ? "saved" : "system");
  updateThemeState();

  systemThemeQuery?.addEventListener("change", () => {
    if (getStoredTheme() !== undefined) return;
    applyTheme(getSystemTheme(), "system");
    updateThemeState();
  });

  themeToggle.addEventListener("click", () => {
    const dark = getEffectiveTheme() === "dark";
    const nextTheme = dark ? "light" : "dark";
    applyTheme(nextTheme, "saved");
    try {
      localStorage.setItem("csv-validator-theme", nextTheme);
    } catch {
      // Theme persistence is optional.
    }
    updateThemeState();
  });
}
