import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("recruiter can inspect the complete evidence journey", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-05-12T10:47:22Z"));
  await page.goto("/runs/demo-run");
  await expect(page.getByRole("heading", { name: "Fix duplicate entitlement grants" })).toBeVisible();
  const blocked = page.getByRole("button", { name: "Blocked: protected path" });
  await expect(blocked).toHaveAttribute("aria-expanded", "true");
  await blocked.click(); await blocked.click();
  await page.getByRole("tab", { name: "Diff" }).click();
  await expect(page.getByRole("heading", { name: "Corrected patch" })).toBeVisible();
  await page.getByRole("tab", { name: "Verification" }).click();
  await expect(page.getByRole("heading", { name: "12 checks passed" })).toBeVisible();
  await expect(page.getByText("Human release gate satisfied")).toBeVisible();
  await page.getByRole("link", { name: /Evaluation evidence/ }).click();
  await expect(page.getByRole("heading", { name: "Evaluation evidence" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Fix duplicate entitlement grants" })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: testInfo.project.name === "mobile" ? "docs/screenshots/mobile.png" : "docs/screenshots/desktop.png", fullPage: true, animations: "disabled" });
});
