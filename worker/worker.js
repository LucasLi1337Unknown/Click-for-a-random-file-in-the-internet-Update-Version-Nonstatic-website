export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null,{headers:corsHeaders()});
    }

    if (url.pathname === "/health") {
      return json({ok:true});
    }

    if (url.pathname !== "/download") {
      return json({error:"Not found"},404);
    }

    const item=url.searchParams.get("item");
    const file=url.searchParams.get("file");
    const requestedName=url.searchParams.get("name")||"random-file";

    if(!item || !file) return json({error:"Missing item or file"},400);

    // Block path tricks.
    if(item.includes("/") || item.includes("\\") || file.includes("..")) {
      return json({error:"Invalid path"},400);
    }

    // We allow archives, documents, web pages, source text, media, etc.,
    // but not random executable/installable/script payloads.
    const blocked=/\.(exe|msi|com|scr|bat|cmd|ps1|vbs|app|dmg|pkg|deb|rpm|apk|ipa|sh|bash|zsh|fish|jar)$/i;
    if(blocked.test(file)) return json({error:"Blocked executable or installer type"},403);

    const path=file.split("/").map(encodeURIComponent).join("/");
    const target=`https://archive.org/download/${encodeURIComponent(item)}/${path}`;

    const upstream=await fetch(target,{
      redirect:"follow",
      headers:{"User-Agent":"RandomInternetFile/2.0"}
    });

    if(!upstream.ok){
      return json({error:`Archive returned ${upstream.status}`},502);
    }

    const headers=new Headers(upstream.headers);
    const safeName=requestedName.replace(/[\r\n"\\]/g,"_");

    headers.set("Content-Disposition",`attachment; filename="${safeName}"`);
    headers.set("Access-Control-Allow-Origin","*");
    headers.set("Cache-Control","public, max-age=300");
    headers.delete("Content-Security-Policy");
    headers.delete("Content-Security-Policy-Report-Only");

    return new Response(upstream.body,{
      status:200,
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
