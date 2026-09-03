// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";
import { recordedDataSource } from "./lib/replay.js";

describe("recruiter evidence journey", () => {
  it("shows the blocked action, corrected evidence and human decision", async () => {
    render(<App dataSource={recordedDataSource()} initialPath="/runs/demo-run" />);
    expect(await screen.findByRole("heading", { name: /fix duplicate entitlement grants/i })).toBeVisible();
    expect(screen.getByText(/blocked: protected path/i)).toBeVisible();
    await userEvent.click(screen.getByRole("tab", { name: /verification/i }));
    expect(screen.getByText(/12 checks passed/i)).toBeVisible();
    expect(screen.getByText(/release approved by human/i)).toBeVisible();
  });

  it("supports keyboard navigation on the plan decision form", async () => {
    const user = userEvent.setup();
    render(<App dataSource={recordedDataSource()} initialPath="/runs/demo-run/plan" />);
    const reason = await screen.findByLabelText(/decision reason/i);
    reason.focus();
    await user.keyboard("Scoped plan with explicit verification.{Tab}{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent(/read-only recorded demo/i);
  });
});
