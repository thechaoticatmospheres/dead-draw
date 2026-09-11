export function textValue(element, value) {
  const next = String(value);
  if (element.textContent !== next) element.textContent = next;
}
export function styleValue(element, property, value) {
  if (element.style[property] !== value) element.style[property] = value;
}
