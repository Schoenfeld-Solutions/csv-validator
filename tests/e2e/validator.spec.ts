import { expect, test } from "@playwright/test";

import { validGlAccountDescriptionCsv } from "../unit/datev-test-fixtures";

const appOrigin = "http://127.0.0.1:4321";

test("root redirects German browser locale to German validator", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "de-DE" });
  const page = await context.newPage();

  await page.goto(`${appOrigin}/csv-validator/`);

  await expect(page).toHaveURL(`${appOrigin}/csv-validator/de/`);
  await expect(
    page.getByRole("heading", { name: "DATEV CSV-Dateien lokal prüfen" })
  ).toBeVisible();
  await context.close();
});

test("root redirects non-German browser locale to English validator and keeps URL state", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "fr-FR" });
  const page = await context.newPage();

  await page.goto(`${appOrigin}/csv-validator/?source=e2e#dropzone`);

  await expect(page).toHaveURL(
    `${appOrigin}/csv-validator/en/?source=e2e#dropzone`
  );
  await expect(
    page.getByRole("heading", { name: "Validate DATEV CSV files locally" })
  ).toBeVisible();
  await context.close();
});

test("loads German and English validator routes with language switch", async ({
  page,
}) => {
  await page.goto("/csv-validator/de/");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(
    page.getByRole("heading", { name: "DATEV CSV-Dateien lokal prüfen" })
  ).toBeVisible();

  await page
    .getByRole("link", { name: "Sprache auf Englisch wechseln" })
    .click();
  await expect(page).toHaveURL(/\/csv-validator\/en\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: "Validate DATEV CSV files locally" })
  ).toBeVisible();
});

test("keeps legal links only in the footer", async ({ page }) => {
  await page.goto("/csv-validator/de/");

  const headerNavigation = page.locator(".site-nav");
  const footer = page.locator(".site-footer");

  await expect(
    headerNavigation.getByRole("link", { exact: true, name: "Validator" })
  ).toBeVisible();
  await expect(
    headerNavigation.getByRole("link", { exact: true, name: "Formate" })
  ).toBeVisible();
  await expect(
    headerNavigation.getByRole("link", { exact: true, name: "Datenschutz" })
  ).toHaveCount(0);
  await expect(
    headerNavigation.getByRole("link", { exact: true, name: "Haftung" })
  ).toHaveCount(0);
  await expect(
    headerNavigation.getByRole("link", { exact: true, name: "Impressum" })
  ).toHaveCount(0);

  await expect(
    footer.getByRole("link", { name: "Datenschutz" })
  ).toHaveAttribute("href", "/csv-validator/de/datenschutz/");
  await expect(footer.getByRole("link", { name: "Haftung" })).toHaveAttribute(
    "href",
    "/csv-validator/de/haftung/"
  );
  await expect(footer.getByRole("link", { name: "Impressum" })).toHaveAttribute(
    "href",
    "/csv-validator/de/impressum/"
  );
});

test("shows the opposite theme icon for the effective system theme", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    localStorage.removeItem("csv-validator-theme");
  });
  await page.goto("/csv-validator/de/");

  const themeToggle = page.getByRole("button", {
    name: "Hell-/Dunkelmodus umschalten",
  });

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(themeToggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".theme-icon-sun")).toBeVisible();
  await expect(page.locator(".theme-icon-moon")).toBeHidden();

  await themeToggle.click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(themeToggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".theme-icon-sun")).toBeHidden();
  await expect(page.locator(".theme-icon-moon")).toBeVisible();
});

test("validates a dropped local CSV file and toggles theme", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/csv-validator/en/");

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "accounts.csv", { type: "text/csv" })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, validGlAccountDescriptionCsv());

  await expect(
    page.getByText(
      "Valid against the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();
  await expect(page.locator("#metaRecognition")).toHaveText(
    "datev-gl-account-description-v3"
  );
  await expect(page.locator(".trust-icon")).toHaveCount(3);

  const themeToggle = page.getByRole("button", {
    name: "Toggle light and dark mode",
  });
  await themeToggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("legal pages are available without placeholders", async ({ page }) => {
  const legalRoutes = [
    ["/csv-validator/de/datenschutz/", "Datenschutz", "de"],
    ["/csv-validator/de/impressum/", "Impressum", "de"],
    ["/csv-validator/de/haftung/", "Haftung und Einordnung", "de"],
    ["/csv-validator/en/privacy/", "Privacy Policy", "en"],
    ["/csv-validator/en/imprint/", "Imprint", "en"],
    ["/csv-validator/en/disclaimer/", "Disclaimer", "en"],
  ] as const;

  for (const [route, heading, locale] of legalRoutes) {
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/PLACEHOLDER/i);
  }
});
