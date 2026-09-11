const btn = document.getElementById("downloadBtn");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const categoryEl = document.getElementById("category");
const maxSizeEl = document.getElementById("maxSize");

const GROUPS = {
  document: { media: ["texts"], ext: [".pdf",".txt",".md",".epub",".rtf",".mobi",".doc",".docx",".odt"] },
  image:    { media: ["image"], ext: [".jpg",".jpeg",".png",".gif",".webp",".svg",".bmp",".tif",".tiff"] },
  audio:    { media: ["audio"], ext: [".mp3",".ogg",".wav",".flac",".m4a",".aac",".opus"] },
  video:    { media: ["movies"], ext: [".mp4",".webm",".mov",".m4v",".ogv"] },
  data:     { media: ["texts"], ext: [".json",".csv",".xml",".tsv",".geojson"] }
};

const DANGEROUS = [
  ".exe",".msi",".bat",".cmd",".com",".scr",".ps1",".vbs",".js",".jar",
  ".app",".dmg",".pkg",".deb",".rpm",".apk",".sh",".bash",".zsh",
  ".zip",".rar",".7z",".tar",".gz",".bz2",".xz",".iso"
];

function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function esc(s){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])); }
function prettyBytes(n){
  n = Number(n || 0);
  if(!n) return "unknown size";
  const units=["B","KB","MB","GB"];
  let i=0;
  while(n>=1024 && i<units.length-1){ n/=1024; i++; }
  return n.toFixed(i?1:0)+" "+units[i];
}

function chosenGroup(){
  const v=categoryEl.value;
  if(v!=="random") return {name:v, ...GROUPS[v]};
  const name=pick(Object.keys(GROUPS));
  return {name, ...GROUPS[name]};
}

function safeCandidate(f, group, maxBytes){
  const name=(f.name||"").toLowerCase();
  const size=Number(f.size||0);
  if(!name) return false;
  if(DANGEROUS.some(x=>name.endsWith(x))) return false;
  if(!group.ext.some(x=>name.endsWith(x))) return false;
  if(size && size>maxBytes) return false;
  if(name.includes("_meta.") || name.includes("_files.xml") || name.includes("__ia_thumb")) return false;
  if(String(f.private||"").toLowerCase()==="true") return false;
  if(String(f.restricted||"").toLowerCase()==="true") return false;
  return true;
}

async function randomIdentifier(group){
  const mediatype=pick(group.media);
  const page=1+Math.floor(Math.random()*80);
  const q=encodeURIComponent(`mediatype:${mediatype} AND -access-restricted-item:true`);
  const url=`https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier&fl[]=title&rows=100&page=${page}&output=json`;
  const r=await fetch(url);
  if(!r.ok) throw new Error("Archive search failed");
  const data=await r.json();
  const docs=data.response?.docs||[];
  if(!docs.length) throw new Error("No public items found");
  return pick(docs).identifier;
}

async function findFile(){
  const group=chosenGroup();
  const maxBytes=Number(maxSizeEl.value)*1024*1024;

  for(let attempt=1;attempt<=16;attempt++){
    statusEl.textContent=`Searching public ${group.name} files… attempt ${attempt}`;
    const id=await randomIdentifier(group);

    const r=await fetch(`https://archive.org/metadata/${encodeURIComponent(id)}`);
    if(!r.ok) continue;

    const meta=await r.json();
    if(meta.is_dark===true) continue;
    if(String(meta.metadata?.["access-restricted-item"]||"").toLowerCase()==="true") continue;

    const candidates=(meta.files||[]).filter(f=>safeCandidate(f,group,maxBytes));
    if(!candidates.length) continue;

    const file=pick(candidates);
    const path=file.name.split("/").map(encodeURIComponent).join("/");
    const direct=`https://archive.org/download/${encodeURIComponent(id)}/${path}?download=1`;

    return {
      id,
      title: meta.metadata?.title || id,
      category: group.name,
      file,
      direct
    };
  }
  throw new Error("Could not find a suitable public file. Try again.");
}

function triggerDownload(found){
  const worker=(window.RANDOM_FILE_CONFIG?.workerBaseUrl||"").replace(/\/$/,"");
  const url=worker
    ? `${worker}/download?url=${encodeURIComponent(found.direct)}&name=${encodeURIComponent(found.file.name.split("/").pop())}`
    : found.direct;

  const a=document.createElement("a");
  a.href=url;
  a.download=found.file.name.split("/").pop()||"random-file";
  a.rel="noopener";
  a.style.display="none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

btn.addEventListener("click", async()=>{
  btn.disabled=true;
  resultEl.classList.add("hidden");

  try{
    const found=await findFile();
    resultEl.innerHTML=
      `<b>${esc(found.file.name)}</b><br>`+
      `Category: ${esc(found.category)}<br>`+
      `Item: ${esc(found.title)}<br>`+
      `Size: ${prettyBytes(found.file.size)}`;
    resultEl.classList.remove("hidden");
    statusEl.textContent="Found one — starting download automatically…";
    triggerDownload(found);
    statusEl.textContent="Download triggered.";
  }catch(err){
    statusEl.textContent=err.message||"Something went wrong.";
  }finally{
    btn.disabled=false;
  }
});
