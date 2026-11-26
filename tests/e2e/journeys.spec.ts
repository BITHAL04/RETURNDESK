import { expect, test, type Page } from "@playwright/test";

const unique = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.toUpperCase();

async function createRequest(page: Page, orderId: string, sku: string) {
  await page.goto("/requests/new");
  await page.getByLabel("Full name").fill("E2E Customer");
  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByLabel("Order ID").fill(orderId);
  await page.getByLabel("Item SKU").fill(sku);
  await page.getByLabel("Item name").fill("Ceramic Vase");
  await page.getByLabel("Quantity").fill("2");
  await page.getByLabel("Reason for return").selectOption("DAMAGED");
  await page.getByRole("button", { name: "Create request" }).click();
}

test("raise, review, approve with refund, note after decision, complete", async ({ page }) => {
  const orderId = `ORD-E2E-${unique()}`;
  await createRequest(page, orderId, "VASE-1");

  await expect(page).toHaveURL(/\/requests\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^RD-\d{6}$/);
  const reference = await page.getByRole("heading", { level: 1 }).textContent();

  // Only legal actions are offered for an Open request.
  await expect(page.getByRole("button", { name: "Start review" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark completed" })).toHaveCount(0);

  await page.getByRole("button", { name: "Start review" }).click();
  await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);

  await page.getByRole("button", { name: "Approve" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: /Approve request/ })).toBeDisabled();
  await dialog.getByText("Refund", { exact: true }).click();
  await dialog.getByLabel(/Refund amount/).fill("39.90");
  await dialog.getByRole("button", { name: /Approve request/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
  await expect(page.getByText("$39.90").first()).toBeVisible();

  await page.getByLabel("Add a note").fill("Refund issued via the payment provider.");
  await page.getByLabel("Your name").fill("E2E Agent");
  await page.getByRole("button", { name: "Post note" }).click();
  // The composer only clears once the server has saved the note.
  await expect(page.getByLabel("Add a note")).toHaveValue("");
  await expect(page.getByText("Refund issued via the payment provider.")).toBeVisible();

  await page.getByRole("button", { name: "Mark completed" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Mark completed" }).click();
  await expect(page.getByRole("button", { name: "Mark completed" })).toHaveCount(0);

  // The note survives a reload: it was persisted, not held in the browser.
  await page.reload();
  await expect(page.getByText("Refund issued via the payment provider.")).toBeVisible();

  // And the request is findable by reference through server-side search.
  await page.goto("/requests");
  await page.getByLabel("Search requests").fill(reference!);
  await expect(page.locator(`text="${reference}" >> visible=true`).first()).toBeVisible();
});

test("duplicate live request is refused with the server's reason", async ({ page }) => {
  const orderId = `ORD-DUP-${unique()}`;
  await createRequest(page, orderId, "SKU-DUP");
  await expect(page).toHaveURL(/\/requests\/[0-9a-f-]{36}$/);

  await createRequest(page, orderId.toLowerCase(), "sku-dup");
  await expect(page.getByText(/already a live request/).first()).toBeVisible();
  await expect(page).toHaveURL(/\/requests\/new$/);
});

test("client-side validation explains what is wrong", async ({ page }) => {
  await page.goto("/requests/new");
  await page.getByRole("button", { name: "Create request" }).click();
  await expect(page.getByText("Customer name is required.")).toBeVisible();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
});

test("edit an open request, then reject and remove it", async ({ page }) => {
  await createRequest(page, `ORD-RM-${unique()}`, "SKU-RM");
  await expect(page).toHaveURL(/\/requests\/[0-9a-f-]{36}$/);
  const detailUrl = page.url();

  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Item name").fill("Ceramic Vase (Large)");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(detailUrl);
  await expect(page.getByText("Ceramic Vase (Large)").first()).toBeVisible();
  await expect(page.getByText("Details corrected")).toBeVisible();

  await page.getByRole("button", { name: "Start review" }).click();
  await page.getByRole("button", { name: "Reject" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reject request" }).click();
  await expect(page.getByText("details are locked")).toBeVisible();

  await page.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove request" }).click();
  await expect(page).toHaveURL(/\/requests$/);

  await page.goto(detailUrl);
  await expect(page.getByText("Request not found")).toBeVisible();
});

test("list filters, empty state and dashboard navigation", async ({ page }) => {
  await page.goto("/requests?q=no-such-customer-anywhere");
  await expect(page.getByText("No requests match your filters")).toBeVisible();

  await page.goto("/requests");
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(page).toHaveURL(/status=COMPLETED/);
  // Desktop shows a table and mobile shows cards; check whichever is visible.
  await expect(
    page.locator(':is(tbody, main ul) >> text="Completed" >> visible=true').first(),
  ).toBeVisible();
  await expect(page.locator(':is(tbody, main ul) >> text="Open" >> visible=true')).toHaveCount(0);

  await page.goto("/dashboard");
  await expect(page.getByText("Status distribution")).toBeVisible();
});

test("layout fits a 375px screen without horizontal scrolling", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile-375");
  for (const path of ["/dashboard", "/requests", "/requests/new"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(0);
  }
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "All requests" }).click();
  await expect(page).toHaveURL(/\/requests$/);
});
