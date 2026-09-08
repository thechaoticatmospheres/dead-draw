export function stick(x = 0, y = 0, deadzone = 0.18) {
  const length = Math.hypot(x, y);
  if (length <= deadzone) return { x: 0, y: 0 };
  const magnitude = Math.pow(
    (Math.min(1, length) - deadzone) / (1 - deadzone),
    1.35,
  );
  return { x: (x / length) * magnitude, y: (y / length) * magnitude };
}
export const emptyPad = () => ({
  forward: 0,
  right: 0,
  aim: false,
  shoot: false,
  sprint: false,
  revive: false,
});
export class GamepadInput {
  constructor({ menu, playing, action, look, mode, notice }) {
    Object.assign(this, { menu, playing, action, look, onMode: mode, notice });
    this.mode = "keyboard";
    this.previous = [];
    this.index = null;
    this.input = emptyPad();
    this.repeatAt = 0;
    this.navKey = "";
    this.focusKey = "";
    this.focusIndex = 0;
    this.armed = false;
    this.settings = { sensitivity: 1, invert: false, rumble: true };
  }
  useKeyboard() {
    if (this.mode !== "keyboard") {
      this.mode = "keyboard";
      this.onMode(this.mode);
      document
        .querySelectorAll(".pad-focus")
        .forEach((e) => e.classList.remove("pad-focus"));
    }
  }
  suspend() {
    this.input = emptyPad();
    this.armed = false;
  }
  rumble(strength = 0.3, duration = 100) {
    if (!this.settings.rumble || this.mode !== "controller") return;
    try {
      this.pad?.vibrationActuator
        ?.playEffect("dual-rumble", {
          startDelay: 0,
          duration,
          strongMagnitude: strength,
          weakMagnitude: strength * 0.55,
        })
        ?.catch(() => {});
    } catch {}
  }
  update(dt, now) {
    this.input = emptyPad();
    let pads = [];
    try {
      pads = Array.from(navigator.getGamepads?.() || []);
    } catch {
      return;
    }
    const pad = pads.find((p) => p?.connected && p.mapping === "standard");
    if (!pad) {
      if (this.index !== null) {
        this.notice("Controller disconnected · keyboard and mouse available");
        this.index = null;
        this.armed = false;
        this.previous = [];
        this.useKeyboard();
      }
      return;
    }
    this.pad = pad;
    const buttons = pad.buttons.map((b) => b.pressed || b.value > 0.5),
      left = stick(pad.axes[0], pad.axes[1]),
      right = stick(pad.axes[2], pad.axes[3]);
    if (this.index !== pad.index) {
      this.index = pad.index;
      this.armed = false;
      this.notice("Controller connected · release controls to begin");
    }
    if (document.hidden || !document.hasFocus()) {
      this.armed = false;
      this.previous = buttons;
      return;
    }
    if (!this.armed) {
      this.armed =
        !buttons.some(Boolean) && !left.x && !left.y && !right.x && !right.y;
      this.previous = buttons;
      return;
    }
    const previous = this.previous;
    const pressed = (i) => !!buttons[i] && !previous[i],
      intent =
        buttons.some((b, i) => b && !this.previous[i]) ||
        Math.hypot(left.x, left.y, right.x, right.y) > 0.08;
    if (intent && this.mode !== "controller") {
      this.mode = "controller";
      this.onMode(this.mode);
    }
    this.previous = buttons;
    if (this.mode !== "controller") return;
    const root = this.menu();
    if (root) {
      this.navigate(root, left, right, pressed, buttons, now, dt);
      if (pressed(1)) this.action("back");
      if (pressed(9)) this.action("back");
      return;
    }
    this.focusKey = "";
    this.navKey = "";
    if (!this.playing()) return;
    if (pressed(9)) {
      this.action("pause");
      return;
    }
    if (pressed(8) || pressed(12)) {
      this.action("map");
      return;
    }
    if (pressed(0)) this.action("interact");
    if (pressed(1)) this.action("dodge");
    if (pressed(11)) this.action("grenade");
    if (pressed(15)) this.action("club");
    if (pressed(2)) this.action("reload");
    if (pressed(3) || pressed(5)) this.action("switch");
    if (pressed(13)) this.action("nextRound");
    this.look(
      -right.x * 2.5 * dt * this.settings.sensitivity * (buttons[6] ? 0.45 : 1),
      -right.y *
        1.8 *
        dt *
        this.settings.sensitivity *
        (buttons[6] ? 0.45 : 1) *
        (this.settings.invert ? -1 : 1),
    );
    // A menu may have opened during this update. Never carry triggers or movement into it.
    if (!this.menu())
      this.input = {
        forward: -left.y,
        right: left.x,
        aim: !!buttons[6],
        shoot: !!buttons[7],
        sprint: !!buttons[10],
        revive: !!buttons[4],
      };
  }
  controls(root) {
    return [
      ...root.querySelectorAll(
        "button:not(:disabled), input:not(:disabled), select:not(:disabled), summary",
      ),
    ].filter((e) => e.getClientRects().length && !e.closest("[hidden]"));
  }
  key(e, index) {
    return (
      e.id ||
      e.tagName +
        ":" +
        [...e.attributes]
          .filter((a) => a.name.startsWith("data-"))
          .map((a) => a.name + "=" + a.value)
          .join("|") +
        ":" +
        (e.textContent || e.name || index).trim()
    );
  }
  navigate(root, left, right, pressed, buttons, now, dt) {
    const controls = this.controls(root);
    if (!controls.length) return;
    let index = controls.findIndex((e, i) => this.key(e, i) === this.focusKey);
    if (index < 0) {
      const preferred = controls.findIndex(
        (e) =>
          e.classList.contains("primary") ||
          e.matches('[data-play],[data-draw],[data-action="roll"]'),
      );
      index =
        this.rootId === root.id
          ? Math.min(this.focusIndex, controls.length - 1)
          : Math.max(0, preferred);
    }
    this.rootId = root.id;
    let direction =
      buttons[12] || left.y < -0.5
        ? "up"
        : buttons[13] || left.y > 0.5
          ? "down"
          : buttons[14] || left.x < -0.5
            ? "left"
            : buttons[15] || left.x > 0.5
              ? "right"
              : "";
    const current = controls[index];
    if (direction && (direction !== this.navKey || now >= this.repeatAt)) {
      if (
        current.matches('input[type="range"],select') &&
        ["left", "right"].includes(direction)
      ) {
        const delta = direction === "right" ? 1 : -1;
        if (current.tagName === "SELECT")
          current.selectedIndex = Math.max(
            0,
            Math.min(current.options.length - 1, current.selectedIndex + delta),
          );
        else
          current.value = String(
            Math.max(
              +current.min,
              Math.min(
                +current.max,
                +current.value + delta * (+current.step || 1),
              ),
            ),
          );
        current.dispatchEvent(new Event("input", { bubbles: true }));
        current.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        const a = current.getBoundingClientRect(),
          ax = a.x + a.width / 2,
          ay = a.y + a.height / 2;
        let best = Infinity,
          next = -1;
        controls.forEach((e, i) => {
          if (i === index) return;
          const b = e.getBoundingClientRect(),
            dx = b.x + b.width / 2 - ax,
            dy = b.y + b.height / 2 - ay,
            primary =
              direction === "right"
                ? dx
                : direction === "left"
                  ? -dx
                  : direction === "down"
                    ? dy
                    : -dy,
            secondary = ["right", "left"].includes(direction)
              ? Math.abs(dy)
              : Math.abs(dx);
          if (primary > 4) {
            const score = primary + secondary * 2.5;
            if (score < best) {
              best = score;
              next = i;
            }
          }
        });
        if (next >= 0) index = next;
      }
      this.repeatAt = now + (direction === this.navKey ? 150 : 350);
    }
    this.navKey = direction;
    if (pressed(5)) index = (index + 1) % controls.length;
    if (pressed(4)) index = (index - 1 + controls.length) % controls.length;
    const target = controls[index],
      changed =
        this.focusKey !== this.key(target, index) ||
        !target.classList.contains("pad-focus");
    document.querySelectorAll(".pad-focus").forEach((e) => {
      if (e !== target) e.classList.remove("pad-focus");
    });
    target.classList.add("pad-focus");
    this.focusKey = this.key(target, index);
    this.focusIndex = index;
    if (changed) {
      if (!target.matches('input[type="text"]'))
        target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    if (Math.abs(right.y) > 0.1) root.scrollTop += right.y * dt * 550;
    if (pressed(0)) {
      if (target.matches('input[type="checkbox"]')) {
        target.checked = !target.checked;
        target.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (target.matches('input[type="text"]')) {
        target.focus();
        this.notice(
          "Use the keyboard for names and room codes. A blank code hosts a game.",
        );
      } else target.click();
    }
  }
}
