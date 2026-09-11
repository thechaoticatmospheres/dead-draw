export class TestingCode {
  constructor() {
    this.keys = [];
    this.at = 0;
  }
  accept(event, now = Date.now()) {
    if (event.repeat) return false;
    if (now - this.at > 4000) this.keys = [];
    this.at = now;
    const sequence = [
      "Numpad8",
      "Numpad8",
      "Numpad2",
      "Numpad2",
      "Numpad4",
      "Numpad6",
      "Numpad4",
      "Numpad6",
    ];
    this.keys.push(event.code);
    while (this.keys.length && !this.keys.every((v, i) => v === sequence[i]))
      this.keys.shift();
    if (this.keys.length !== sequence.length) return false;
    this.keys = [];
    return true;
  }
}
export class TestingUI {
  constructor(send) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<section id="testingPanel" class="crew-panel" hidden><button id="closeTesting">✕</button><span class="eyebrow">ROOM HOST · DEVELOPMENT TOOLS</span><h2>Admin / testing</h2><p id="testingStatus"></p><p class="table-note">Changes affect this room immediately and mark the run as testing. Test runs do not earn career records. The keypad sequence opens this menu; it is not an account password.</p><fieldset id="testingControls"><h3>YOUR SURVIVOR</h3><label>Amount <input id="testingAmount" type="number" min="1" max="100000" step="1" value="1000"></label><div class="choice-row"><button data-test-action="chips">GIVE CHIPS</button><button data-test-action="comps">GIVE COMPS</button><button data-test-action="restore">HEAL / REVIVE + AMMO</button></div><h3>ROUND CONTROL</h3><label>Wave <input id="testingWave" type="number" min="1" max="100" step="1" value="1"></label><div class="choice-row"><button data-test-action="wave">START SELECTED WAVE</button><button data-test-action="break">RETURN TO INTERMISSION</button></div></fieldset><p class="table-note">NUMPAD 8 8 2 2 4 6 4 6 · ESC TO CLOSE</p></section>`,
    );
    this.root = document.querySelector("#testingPanel");
    this.status = document.querySelector("#testingStatus");
    this.controls = document.querySelector("#testingControls");
    document.querySelector("#closeTesting").onclick = () =>
      (this.root.hidden = true);
    this.root.querySelectorAll("[data-test-action]").forEach(
      (button) =>
        (button.onclick = () => {
          const action = button.dataset.testAction;
          const input = document.querySelector(
            action === "wave" ? "#testingWave" : "#testingAmount",
          );
          if (
            ["wave", "chips", "comps"].includes(action) &&
            !input.reportValidity()
          )
            return;
          send({ type: "testing", action, value: Number(input.value) });
        }),
    );
  }
  toggle(p, state) {
    this.root.hidden = !this.root.hidden;
    this.update(p, state);
  }
  update(p, state) {
    if (this.root.hidden) return;
    const host = state?.testingHost === p?.id;
    this.controls.disabled =
      !host || !["combat", "break"].includes(state?.phase);
    this.status.textContent = !host
      ? "Only the current room host can use these controls."
      : !["combat", "break"].includes(state?.phase)
        ? "Start a run to use testing controls."
        : `${state.testing ? "TESTING RUN" : "NORMAL RUN"} · Wave ${state.round} · ${p.chips} chips · ${p.comps || 0} comps`;
  }
}
