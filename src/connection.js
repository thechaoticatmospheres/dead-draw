export function gameSocketURL(page, configured = "") {
  const endpoint = configured.trim();
  const url = new URL(
    endpoint ||
      `${page.protocol === "https:" ? "wss:" : "ws:"}//${page.host}/game`,
  );
  if (
    !["http:", "https:", "ws:", "wss:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("The multiplayer server URL is invalid.");
  url.protocol = ["https:", "wss:"].includes(url.protocol) ? "wss:" : "ws:";
  if (page.protocol === "https:" && url.protocol !== "wss:")
    throw new Error("The multiplayer server must use a secure connection.");
  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = path.endsWith("/game") ? path : `${path}/game`;
  return url.href;
}
