import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../server/game.js";
import { WEAPONS } from "../shared/data.js";
import { giveReward } from "../server/casino.js";
import { Checkpoints } from "../server/checkpoints.js";

function setup() {
  const game = new Game("RELOAD");
  game.addPlayer("a", "A");
  game.addPlayer("b", "B");
  game.restart();
  return [game, game.players.a, game.players.b];
}

test("Auto Reload costs six comps, buys once between rounds and survives checkpoints", () => {
  const [g, p] = setup();
  p.comps = 5;
  g.buy(p, "autoReload");
  assert.equal(p.perks.autoReload, undefined);
  p.comps = 12;
  g.phase = "combat";
  g.buy(p, "autoReload");
  assert.equal(p.comps, 12);
  g.phase = "break";
  g.buy(p, "autoReload");
  assert.equal(p.perks.autoReload, 1);
  assert.equal(p.comps, 6);
  g.buy(p, "autoReload");
  assert.equal(p.comps, 6);
  const saves = new Checkpoints("test-only");
  assert.equal(
    saves.restore(saves.open(saves.seal(g))).players.a.perks.autoReload,
    1,
  );
});

test("empty weapons reload only for the perk owner, using reserve ammo and existing speed upgrades", () => {
  const [g, p, q] = setup();
  p.perks = { autoReload: 1, reload: 2 };
  p.guns[0].attachments = { action: "speedloader" };
  p.guns[0].ammo = q.guns[0].ammo = 0;
  p.guns[0].reserve = 5;
  g.update(1 / 30);
  const duration = WEAPONS[p.guns[0].id].reload * 0.75 * 0.7;
  assert.ok(Math.abs(p.reload - duration) < 1e-8);
  assert.equal(q.reload, 0);
  assert.equal(p.guns[0].ammo, 0);
  g.update(0.1);
  assert.ok(Math.abs(p.reload - (duration - 0.1)) < 1e-8, "timer is not reset");
  for (let i = 0; i < 100; i++) g.update(1 / 30);
  assert.equal(p.guns[0].ammo, 5);
  assert.equal(p.guns[0].reserve, 0);
  assert.equal(p.reload, 0);
});

test("firing the final round triggers reload and reload completes while the trigger is held", () => {
  const [g, p] = setup();
  p.perks.autoReload = 1;
  p.guns[0].ammo = 1;
  g.action(p.id, { type: "input", input: { shoot: true } });
  g.update(1 / 30);
  assert.equal(p.guns[0].ammo, 0);
  assert.ok(p.reload > 0);
  for (let i = 0; i < 100; i++) {
    g.action(p.id, { type: "input", input: { shoot: true } });
    g.update(1 / 30);
  }
  assert.ok(p.shots > 1);
});

test("no auto reload while downed or rolling, without reserve ammo, or for the sword", () => {
  const [g, p] = setup();
  p.perks.autoReload = 1;
  p.guns[0].ammo = 0;
  p.down = true;
  g.update(1 / 30);
  assert.equal(p.reload, 0);
  p.down = false;
  g.dodge(p);
  g.update(1 / 30);
  assert.equal(p.reload, 0);
  p.dodgeTime = 0;
  p.guns[0].reserve = 0;
  g.update(1 / 30);
  assert.equal(p.reload, 0);
  giveReward(p, "sword");
  g.update(1 / 30);
  assert.equal(p.reload, 0);
});
