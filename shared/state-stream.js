// Lossless, negotiated snapshots. Legacy clients keep receiving ordinary state messages.
export const STATE_PROTOCOL = 2;
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const safeKey = (k) => !["__proto__", "constructor", "prototype"].includes(k);
function difference(previous, next) {
  if (previous === next) return null;
  if (
    !previous ||
    !next ||
    typeof previous !== "object" ||
    typeof next !== "object" ||
    Array.isArray(previous) !== Array.isArray(next) ||
    (Array.isArray(next) && previous.length !== next.length)
  )
    return [0, next];
  const changes = {},
    removed = [];
  for (const key of Object.keys(next)) {
    const patch = own(previous, key)
      ? difference(previous[key], next[key])
      : [0, next[key]];
    if (patch) changes[key] = patch;
  }
  for (const key of Object.keys(previous))
    if (!own(next, key)) removed.push(key);
  return Object.keys(changes).length || removed.length
    ? [1, changes, removed]
    : null;
}
function apply(previous, patch) {
  if (!patch) return previous;
  if (patch[0] === 0) return patch[1];
  const next = Array.isArray(previous) ? previous.slice() : { ...previous };
  for (const key of patch[2]) if (safeKey(key)) delete next[key];
  for (const [key, value] of Object.entries(patch[1]))
    if (safeKey(key)) next[key] = apply(previous?.[key], value);
  return next;
}
export function prepareStateFrame(snapshot, previous = null) {
  const { events, games, type, ...fields } = snapshot;
  const json = JSON.stringify(fields),
    data = JSON.parse(json);
  return {
    id: (previous?.id || 0) + 1,
    base: previous?.id,
    json,
    data,
    patch: previous ? difference(previous.data, data) : null,
  };
}
export class StateEncoder {
  constructor() {
    this.sequence = 0;
    this.previous = null;
  }
  reset() {
    this.previous = null;
  }
  encode(snapshot, events = snapshot.events || [], frame = null) {
    // Detach from the mutable simulation, and match JSON's legacy undefined/null semantics.
    const { events: ignored, type: ignoredType, ...fields } = snapshot;
    const privateJSON = frame ? JSON.stringify(snapshot.games || {}) : null;
    const data = frame
      ? { ...frame.data, games: JSON.parse(privateJSON) }
      : JSON.parse(JSON.stringify(fields));
    const sequence = ++this.sequence;
    const eventJSON = JSON.stringify(events);
    const dataJSON = frame
      ? frame.json.slice(0, -1) + ',"games":' + privateJSON + "}"
      : JSON.stringify(data);
    const full = `{"type":"state-v2","protocol":${STATE_PROTOCOL},"sequence":${sequence},"data":${dataJSON},"events":${eventJSON}}`;
    let wire = full;
    if (
      this.previous &&
      sequence % 150 !== 0 &&
      (!frame || frame.base === this.previousFrame)
    ) {
      let patch;
      if (frame) {
        const gamePatch = difference(this.previous.games, data.games);
        patch =
          frame.patch || gamePatch
            ? [
                1,
                {
                  ...(frame.patch?.[1] || {}),
                  ...(gamePatch ? { games: gamePatch } : {}),
                },
                frame.patch?.[2] || [],
              ]
            : null;
      } else patch = difference(this.previous, data);
      const delta = JSON.stringify({
        type: "patch-v2",
        protocol: STATE_PROTOCOL,
        sequence,
        base: sequence - 1,
        patch,
        events,
      });
      if (delta.length < full.length) wire = delta;
    }
    this.previous = data;
    this.previousFrame = frame?.id;
    return wire;
  }
}
export class StateDecoder {
  constructor() {
    this.sequence = 0;
    this.data = null;
    this.needsResync = false;
  }
  decode(message) {
    if (!["state-v2", "patch-v2"].includes(message.type)) return message;
    if (message.protocol !== STATE_PROTOCOL) {
      this.needsResync = true;
      return null;
    }
    if (message.type === "state-v2") this.data = message.data;
    else {
      if (
        !this.data ||
        message.base !== this.sequence ||
        message.sequence !== this.sequence + 1
      ) {
        this.needsResync = true;
        return null;
      }
      this.data = apply(this.data, message.patch);
    }
    this.sequence = message.sequence;
    this.needsResync = false;
    return { ...this.data, type: "state", events: message.events || [] };
  }
}
