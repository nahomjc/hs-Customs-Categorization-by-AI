/**
 * Offline test for the Settings tab logic, the new VDD sidebar entry and a
 * static render of the tab bar. No database, no browser.
 *
 *   npm run test:settings-nav
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsTabs } from "../components/dashboard/SettingsTabs";
import {
  getDashboardNavGroups,
  getDashboardNavLinks,
} from "../components/dashboard/DashboardSidebar";
import { isDashboardNavActive } from "../lib/dashboardNav";
import {
  nextTabIndex,
  resolveSettingsTab,
  settingsTabDescription,
  visibleSettingsTabs,
} from "../lib/settings/settings-tabs";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

test("settings tabs: VDD is gone, Channels stays admin-only", () => {
  assert.deepEqual(visibleSettingsTabs(true).map((t) => t.id), ["general", "channels"]);
  assert.deepEqual(visibleSettingsTabs(false).map((t) => t.id), ["general"]);
  assert.equal(resolveSettingsTab("channels", true), "channels");
  assert.equal(resolveSettingsTab("channels", false), "general");
  assert.equal(resolveSettingsTab("vdd", true), "general", "old VDD tab no longer resolves in Settings");
  assert.equal(resolveSettingsTab(null, true), "general");
  assert.equal(resolveSettingsTab("nonsense", true), "general");
  assert.match(settingsTabDescription("channels", "admin"), /Telegram/);
  assert.match(settingsTabDescription("general", "client"), /notification/);
});

test("settings tabs: arrow keys wrap, Home/End jump, other keys ignored", () => {
  assert.equal(nextTabIndex("ArrowRight", 0, 2), 1);
  assert.equal(nextTabIndex("ArrowRight", 1, 2), 0);
  assert.equal(nextTabIndex("ArrowLeft", 0, 2), 1);
  assert.equal(nextTabIndex("Home", 1, 3), 0);
  assert.equal(nextTabIndex("End", 0, 3), 2);
  assert.equal(nextTabIndex("Enter", 0, 3), null);
  assert.equal(nextTabIndex("ArrowRight", 0, 0), null);
});

test("sidebar: VDD import is admin-only and has its own active state", () => {
  const hrefs = (o: Parameters<typeof getDashboardNavLinks>[0]) => getDashboardNavLinks(o).map((l) => l.href);
  assert.ok(hrefs({ isAdmin: true }).includes("/dashboard/vdd"));
  assert.ok(!hrefs({ isAdmin: false, isAssessor: true }).includes("/dashboard/vdd"));
  assert.ok(!hrefs({ isClient: true }).includes("/dashboard/vdd"));
  const management = getDashboardNavGroups({ isAdmin: true }).find((g) => g.id === "management");
  assert.ok(management?.links.some((l) => l.href === "/dashboard/vdd" && l.label === "VDD import"));
  assert.ok(isDashboardNavActive("/dashboard/vdd", "/dashboard/vdd", false));
  assert.ok(!isDashboardNavActive("/dashboard/vdd", "/dashboard/settings", true));
  assert.ok(!isDashboardNavActive("/dashboard/settings", "/dashboard/vdd", false));
});

test("sidebar: Demo requests is admin-only under Management", () => {
  const hrefs = (o: Parameters<typeof getDashboardNavLinks>[0]) =>
    getDashboardNavLinks(o).map((l) => l.href);
  assert.ok(hrefs({ isAdmin: true }).includes("/dashboard/demo-requests"));
  assert.ok(
    !hrefs({ isAdmin: false, isAssessor: true }).includes("/dashboard/demo-requests"),
  );
  assert.ok(!hrefs({ isClient: true }).includes("/dashboard/demo-requests"));
  const management = getDashboardNavGroups({ isAdmin: true }).find(
    (g) => g.id === "management",
  );
  assert.ok(
    management?.links.some(
      (l) => l.href === "/dashboard/demo-requests" && l.label === "Demo requests",
    ),
  );
});

test("smoke: tab bar markup (roles, aria, brand-blue active, no shadows)", () => {
  const html = renderToStaticMarkup(
    createElement(SettingsTabs, { tabs: visibleSettingsTabs(true), activeId: "channels", onSelect: () => {} }),
  );
  assert.ok(html.includes('role="tablist"') && html.includes('aria-label="Settings sections"'));
  assert.equal((html.match(/role="tab"/g) ?? []).length, 2);
  assert.equal((html.match(/aria-selected="true"/g) ?? []).length, 1);
  assert.ok(html.includes('aria-controls="settings-panel-channels"') && html.includes('id="settings-tab-general"'));
  assert.ok(html.includes('tabindex="0"') && html.includes('tabindex="-1"'), "roving tabindex");
  assert.ok(html.includes("border-[#007bff]") && html.includes("text-[#007bff]"));
  assert.ok(html.includes("overflow-x-auto"), "scrolls sideways on small screens");
  assert.ok(html.includes("Profile and preferences") && html.includes("Telegram and SMS alerts"));
  assert.ok(!html.includes("VDD"));
  assert.ok(!/shadow-|NaN|undefined|null/.test(html));
});

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);