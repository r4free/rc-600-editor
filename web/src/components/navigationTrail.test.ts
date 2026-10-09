import { strict as assert } from "node:assert";
import { test } from "node:test";
import { navigationTrail, type ActiveTabGroup } from "./navigationTrail";

const trail = (...pairs: [string, string][]) => navigationTrail(pairs.map(([name, selected]) => ({ name, selected }))).map(x => x.selected);

test("only real descendants appear, regardless of ordering or stale parallel tabs", () => {
  assert.deepEqual(trail(["Output", "Routing"], ["Loop", "Rhythm"], ["Workspace", "Memory"], ["Memory editor", "Loop"], ["System", "Setup"]), ["Memory", "Loop", "Rhythm"]);
});
test("conditional track, routing and EQ children follow current tab", () => {
  assert.deepEqual(trail(["Workspace", "Memory"], ["Memory editor", "Loop"], ["Loop", "Tracks"], ["Track", "Track 4"]), ["Memory", "Loop", "Tracks", "Track 4"]);
  assert.deepEqual(trail(["Workspace", "Memory"], ["Memory editor", "Output"], ["Output", "Routing"], ["Routing", "Input/Rhythm"], ["Output EQ", "MAIN L/R"]), ["Memory", "Output", "Routing", "Input/Rhythm"]);
  assert.deepEqual(trail(["Workspace", "System"], ["System", "Input"], ["Input", "EQ"], ["Input EQ", "MIC 1/2"]), ["System", "Input", "EQ", "MIC 1/2"]);
});
test("workspaces and leaf tabs do not inherit another branch", () => {
  const groups: ActiveTabGroup[] = [{ name: "Workspace", selected: "Setlists" }, { name: "System", selected: "Setup" }];
  assert.deepEqual(navigationTrail(groups), [groups[0]]);
  assert.deepEqual(trail(["Workspace", "Memory"], ["Memory editor", "Assigns"], ["Loop", "Tracks"]), ["Memory", "Assigns"]);
  assert.deepEqual(trail(["Workspace", "Memory"]), ["Memory"]);});
