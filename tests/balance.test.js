import test from "node:test";
import assert from "node:assert/strict";
import { kenoReturn, unlockProjection } from "../tools/balance-report.js";
import { waveClearBonus } from "../shared/campaign.js";
test("all seven Keno ticket sizes return 84–87% in chips before equipment/comps", () => {
  for (let n = 2; n <= 8; n++)
    for (const stake of [20, 50, 100]) {
      const value = kenoReturn(n, stake);
      assert.ok(
        value >= 0.84 && value <= 0.87,
        `${n} spots at ${stake}: ${value}`,
      );
    }
});
test("wave income ramps to a cap and pooled room progression remains ordered and attainable", () => {
  assert.equal(waveClearBonus(1), 25);
  assert.equal(waveClearBonus(10), 70);
  assert.equal(waveClearBonus(100), 125);
  for (const team of [1, 2, 4]) {
    const rows = unlockProjection(team);
    assert.equal(rows.length, 11);
    assert.ok(rows.at(-1).wave <= 24);
    for (let i = 1; i < rows.length; i++)
      assert.ok(rows[i].wave >= rows[i - 1].wave);
  }
});
