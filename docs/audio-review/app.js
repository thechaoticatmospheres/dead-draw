const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let catalog,
  decisions = { version: 1, sounds: {} },
  ctx,
  master,
  generation = 0,
  active = [],
  saveQueue = Promise.resolve(),
  revision = 0;
const buffers = new Map();
const PAGE_SIZE = 6;
let page = 0;
const group = (s) => s.group || (s.weapon ? "Weapons" : "Zombie vocals");
const blank = () => ({
  pick: null,
  alternates: [],
  notes: "",
  regenerate: false,
});
const choice = (id) => (decisions.sounds[id] ||= blank());
async function getJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw Error(`Unable to load ${path}`);
  return r.json();
}
function persist(id) {
  const thisRevision = ++revision;
  const snapshot = JSON.stringify({ sounds: { [id]: choice(id) } });
  $("#save-status").textContent = "Saving your review…";
  saveQueue = saveQueue
    .catch(() => {})
    .then(async () => {
      const r = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: snapshot,
      });
      if (!r.ok) throw Error("Save failed");
      const saved = await r.json();
      if (revision === thisRevision) {
        decisions = saved;
        update();
        $("#save-status").textContent = "All choices saved to this project";
      }
    })
    .catch(() => {
      $("#save-status").textContent =
        "Could not save. Export your selections before closing.";
    });
}
function stop() {
  generation++;
  for (const s of active) {
    try {
      s.stop();
    } catch {}
  }
  active = [];
  document
    .querySelectorAll(".playing")
    .forEach((el) => el.classList.remove("playing"));
  document
    .querySelectorAll("[data-play]")
    .forEach(
      (el) =>
        (el.textContent =
          el.dataset.repeat === "true" ? "↻ Repeat preview" : "▶ Play"),
    );
}
async function play(sound, candidate, repeat, button) {
  stop();
  const token = generation;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 3;
      limiter.ratio.value = 16;
      master.connect(limiter).connect(ctx.destination);
    }
    master.gain.value = Number($("#volume").value);
    await ctx.resume();
    if (!buffers.has(candidate.id))
      buffers.set(
        candidate.id,
        fetch(candidate.file)
          .then((r) => {
            if (!r.ok) throw Error("Audio file unavailable");
            return r.arrayBuffer();
          })
          .then((b) => ctx.decodeAudioData(b))
          .catch((e) => {
            buffers.delete(candidate.id);
            throw e;
          }),
      );
    button.textContent = "Loading…";
    const buffer = await buffers.get(candidate.id);
    if (token !== generation) return;
    button.closest(".candidate").classList.add("playing");
    button.textContent = repeat ? "↻ Previewing…" : "▶ Playing…";
    if (repeat && sound.loop) {
      const s = ctx.createBufferSource();
      s.buffer = buffer;
      s.loop = true;
      s.connect(master);
      active.push(s);
      s.onended = () => {
        s.disconnect();
        if (token === generation) stop();
      };
      s.start(ctx.currentTime + 0.03);
      s.stop(ctx.currentTime + 0.03 + buffer.duration * 3);
      return;
    }
    const n = repeat ? (sound.cue === "shot" ? 5 : 3) : 1;
    let remaining = n;
    for (let i = 0; i < n; i++) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(master);
      active.push(source);
      source.onended = () => {
        source.disconnect();
        if (--remaining === 0 && token === generation) stop();
      };
      source.start(ctx.currentTime + 0.03 + i * sound.interval);
    }
  } catch (e) {
    if (token === generation) {
      stop();
      $("#save-status").textContent = "Playback failed: " + e.message;
    }
  }
}
function waveform(values) {
  return `<svg class="wave" viewBox="0 0 300 56" preserveAspectRatio="none" aria-hidden="true">${values.map((v, i) => `<line x1="${i * 3}" x2="${i * 3}" y1="${28 - v * 25}" y2="${28 + v * 25}" stroke="#8cae86" stroke-width="1.6"/>`).join("")}</svg>`;
}
function card(sound, c) {
  return `<article class="candidate" data-candidate="${esc(c.id)}"><div class="candidate-top"><span class="letter">${esc(c.label)}</span>${c.rank === 1 ? '<span class="tag">TECHNICAL PICK</span>' : `<span class="type">TAKE ${c.take}</span>`}</div>${waveform(c.waveform)}<div class="candidate-body"><div class="meta">${c.duration.toFixed(2)} SEC · ELEVENLABS SFX V2</div><h3>${esc(c.title)}</h3><p>${esc(c.note)}</p><div class="play-controls"><button class="play" data-play="${esc(c.id)}" data-repeat="false" aria-label="Play ${esc(sound.name)} option ${c.label}">▶ Play</button><button data-play="${esc(c.id)}" data-repeat="true" aria-label="Repeat ${esc(sound.name)} option ${c.label}">↻ Repeat preview</button></div><div class="choices"><button data-pick="${esc(c.id)}" aria-pressed="false">Pick ${c.label}</button><button data-alternate="${esc(c.id)}" aria-pressed="false">Keep alternate</button></div></div></article>`;
}
function filtered() {
  const q = $("#search").value.toLowerCase().trim(),
    category = $("#category").value;
  return catalog.sounds.filter(
    (s) =>
      ($("#show-previous").checked ||
        (s.batch || 1) === (catalog.currentBatch || 1)) &&
      (!category || group(s) === category) &&
      (!$("#only-pending").checked || !choice(s.id).pick) &&
      (!q ||
        `${s.name} ${s.id} ${s.cue} ${(s.appliesTo || []).join(" ")}`
          .toLowerCase()
          .includes(q)),
  );
}
function render() {
  stop();
  const all = filtered();
  page = Math.max(0, Math.min(page, Math.ceil(all.length / PAGE_SIZE) - 1));
  const visible = all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  $("#sounds").innerHTML = visible
    .map(
      (s, i) =>
        `<section class="sound" data-sound="${esc(s.id)}"><div class="sound-heading"><span class="number">0${i + 1}</span><div><span class="type">${esc(group(s))} · ${s.loop ? "LOOP" : "BATCH " + (s.batch || 1)}</span><h2>${esc(s.name)}</h2></div><span class="status"></span></div><div class="candidates">${s.candidates
          .filter((c) => c.rank <= 3)
          .map((c) => card(s, c))
          .join(
            "",
          )}</div><details class="extra"><summary>Hear the remaining candidate</summary>${s.candidates
          .filter((c) => c.rank > 3)
          .map((c) => card(s, c))
          .join(
            "",
          )}</details><div class="feedback"><label>Direction for the next pass<textarea maxlength="4000" data-notes="${esc(s.id)}" placeholder="More weight? Less rasp? Tell me what to change."></textarea></label><button data-regenerate="${esc(s.id)}" aria-pressed="false">Request new options</button></div></section>`,
    )
    .join("");
  for (const s of visible)
    document.querySelector(`[data-notes="${s.id}"]`).value = choice(s.id).notes;
  for (const suffix of ["", "-bottom"]) {
    $("#page-info" + suffix).textContent = all.length
      ? `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + visible.length} of ${all.length} sounds`
      : "0 sounds";
    $("#previous-page" + suffix).disabled = page === 0;
    $("#next-page" + suffix).disabled = (page + 1) * PAGE_SIZE >= all.length;
  }
  update();
}
function update() {
  const current = catalog.sounds.filter(
    (s) => (s.batch || 1) === (catalog.currentBatch || 1),
  );
  const picked = current.filter((s) => choice(s.id).pick).length;
  for (const s of catalog.sounds) {
    const d = choice(s.id),
      panel = document.querySelector(`[data-sound="${s.id}"]`);
    if (!panel) continue;
    panel.querySelector(".status").textContent =
      (d.pick
        ? `Selected: ${s.candidates.find((c) => c.id === d.pick)?.label}`
        : "Awaiting your pick") +
      (d.regenerate ? " · New options requested" : "");
    for (const c of s.candidates) {
      panel
        .querySelector(`[data-candidate="${c.id}"]`)
        .classList.toggle("chosen", d.pick === c.id);
      panel
        .querySelector(`[data-pick="${c.id}"]`)
        .setAttribute("aria-pressed", String(d.pick === c.id));
      panel
        .querySelector(`[data-alternate="${c.id}"]`)
        .setAttribute("aria-pressed", String(d.alternates.includes(c.id)));
    }
    const b = panel.querySelector("[data-regenerate]");
    b.setAttribute("aria-pressed", String(d.regenerate));
    b.textContent = d.regenerate
      ? "✓ New options requested"
      : "Request new options";
  }
  $("#count").textContent = `${picked} / ${current.length}`;
  $("#progress").style.width = `${(picked / current.length) * 100}%`;
  $("#batch-names").textContent =
    current.length > 8
      ? "Weapons · Handling · Zombies · Abilities · Impacts"
      : current.map((s) => s.name).join(" · ");
  $("#batch-summary").textContent =
    `Batch ${catalog.currentBatch || 1}: ${current.length} sounds ready for review. Search a name, filter by category, or show only unselected sounds. Earlier choices are saved.`;
}
for (const id of ["search", "category", "only-pending", "show-previous"])
  $("#" + id).addEventListener(id === "search" ? "input" : "change", () => {
    page = 0;
    render();
  });
for (const suffix of ["", "-bottom"]) {
  $("#previous-page" + suffix).onclick = () => {
    page--;
    render();
    $("#pilot").scrollIntoView();
  };
  $("#next-page" + suffix).onclick = () => {
    page++;
    render();
    $("#pilot").scrollIntoView();
  };
}
$("#sounds").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const s = catalog.sounds.find(
      (s) => s.id === b.closest("[data-sound]").dataset.sound,
    ),
    d = choice(s.id);
  if (b.dataset.play)
    return void play(
      s,
      s.candidates.find((c) => c.id === b.dataset.play),
      b.dataset.repeat === "true",
      b,
    );
  if (b.dataset.pick) {
    d.pick = d.pick === b.dataset.pick ? null : b.dataset.pick;
    d.alternates = d.alternates.filter((id) => id !== d.pick);
  }
  if (b.dataset.alternate) {
    const id = b.dataset.alternate;
    d.alternates = d.alternates.includes(id)
      ? d.alternates.filter((a) => a !== id)
      : [...d.alternates, id];
    if (d.pick === id) d.pick = null;
  }
  if (b.dataset.regenerate) d.regenerate = !d.regenerate;
  update();
  persist(s.id);
  if ($("#only-pending").checked) render();
});
$("#sounds").addEventListener("input", (e) => {
  if (e.target.dataset.notes) {
    choice(e.target.dataset.notes).notes = e.target.value;
    persist(e.target.dataset.notes);
  }
});
$("#stop").onclick = stop;
$("#volume").oninput = () => {
  if (master)
    master.gain.setTargetAtTime(
      Number($("#volume").value),
      ctx.currentTime,
      0.01,
    );
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});
window.addEventListener("pagehide", stop);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") stop();
});
for (const tab of ["pilot", "inventory"])
  $(`#${tab}-tab`).onclick = () => {
    stop();
    for (const t of ["pilot", "inventory"]) {
      $(`#${t}`).hidden = t !== tab;
      $(`#${t}-tab`).setAttribute("aria-selected", String(t === tab));
    }
  };
$("#export").onclick = () => {
  const summary = {
    ...decisions,
    flow: catalog.flow_url,
    exportedAt: new Date().toISOString(),
    selectedFiles: catalog.sounds.map((s) => ({
      sound: s.id,
      pick: s.candidates.find((c) => c.id === choice(s.id).pick)?.file || null,
    })),
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "dead-draw-sound-selections.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
try {
  const [data, saved, inventory] = await Promise.all([
    getJSON("catalog.json"),
    getJSON("/api/decisions"),
    getJSON("inventory.json"),
  ]);
  catalog = data;
  decisions = saved;
  $("#category").innerHTML =
    '<option value="">All categories</option>' +
    [...new Set(catalog.sounds.map(group))]
      .map((g) => `<option>${esc(g)}</option>`)
      .join("");
  render();
  $("#save-status").textContent = "Ready · Your choices save automatically";
  const table = (title, rows) =>
    `<h2>${title}</h2><table><thead><tr><th>Character / weapon</th><th>Sound set</th><th>Status</th></tr></thead><tbody>${rows.map((r) => `<tr><td><strong>${esc(r.name)}</strong><small>${esc(r.id)}</small></td><td>${esc(r.cues.join(" · "))}${r.special ? `<small>${esc(r.special)}</small>` : ""}</td><td>${esc(r.status)}</td></tr>`).join("")}</tbody></table>`;
  $("#inventory-content").innerHTML =
    table("14 weapons", inventory.weapons) +
    table("10 enemy types", inventory.enemies) +
    `<h2>Shared sound families</h2><p class="muted">${esc(inventory.shared.join(" · "))}</p>`;
} catch (e) {
  $("#save-status").textContent = e.message;
}
