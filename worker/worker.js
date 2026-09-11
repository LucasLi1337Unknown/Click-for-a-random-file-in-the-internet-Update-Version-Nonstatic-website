export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    if (url.pathname !== "/download") {
      return json({ error: "Not found" }, 404);
    }

    const target = url.searchParams.get("url");
    const requestedName = url.searchParams.get("name") || "random-file";

    if (!target) return json({ error: "Missing url" }, 400);

    let parsed;
    try { parsed = new URL(target); }
    catch { return json({ error: "Bad url" }, 400); }

    // SSRF protection: this worker only proxies Internet Archive downloads.
    const allowedHosts = new Set([
      "archive.org",
      "www.archive.org"
    ]);

    if (!allowedHosts.has(parsed.hostname)) {
      return json({ error: "Only archive.org URLs are allowed" }, 403);
    }

    // Safety: do not proxy obviously high-risk executable/archive types.
    const bad = /\.(exe|msi|bat|cmd|com|scr|ps1|vbs|jar|dmg|pkg|deb|rpm|apk|sh|bash|zsh|zip|rar|7z|tar|gz|bz2|xz|iso)$/i;
    if (bad.test(parsed.pathname)) {
      return json({ error: "Blocked file type" }, 403);
    }

    const upstream = await fetch(parsed.toString(), {
      redirect: "follow",
      headers: { "User-Agent": "RandomInternetFile/1.0" }
    });

    if (!upstream.ok) {
      return json({ error: `Upstream returned ${upstream.status}` }, 502);
    }

    const headers = new Headers(upstream.headers);
    const safeName = requestedName.replace(/[\r\n"]/g, "_");
    headers.set("Content-Disposition", `attachment; filename="${safeName}"`);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.delete("Content-Security-Policy");

    return new Response(upstream.body, {
      status: 200,
      headers
    });
  }
};

function corsHeaders(){
  return {
    "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Methods":"GET,OPTIONS",
    "Access-Control-Allow-Headers":"*"
  };
}

function json(obj,status=200){
  return new Response(JSON.stringify(obj),{
    status,
    headers:{...corsHeaders(),"Content-Type":"application/json"}
  });
}
