const btn = document.getElementById("downloadBtn");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const categoryEl = document.getElementById("category");
const maxSizeEl = document.getElementById("maxSize");

const GROUPS = {
  document: {
    media:["texts"],
    ext:[".pdf",".txt",".md",".rtf",".epub",".mobi",".djvu",".doc",".docx",".odt",".pages"]
  },
  spreadsheet: {
    media:["texts"],
    ext:[".csv",".tsv",".xls",".xlsx",".ods",".numbers"]
  },
  presentation: {
    media:["texts"],
    ext:[".ppt",".pptx",".odp",".key"]
  },
  image: {
    media:["image"],
    ext:[".jpg",".jpeg",".png",".gif",".webp",".svg",".bmp",".tif",".tiff",".ico",".heic"]
  },
  audio: {
    media:["audio"],
    ext:[".mp3",".ogg",".wav",".flac",".m4a",".aac",".opus",".aiff",".wma"]
  },
  video: {
    media:["movies"],
    ext:[".mp4",".webm",".mov",".m4v",".ogv",".avi",".mkv",".mpeg",".mpg"]
  },
  archive: {
    media:["texts","software"],
    ext:[".zip",".rar",".7z",".tar",".gz",".bz2",".xz",".tgz"]
  },
  web: {
    media:["texts","web"],
    ext:[".html",".htm",".css",".xml",".xhtml",".mhtml"]
  },
  data: {
    media:["texts"],
    ext:[".json",".jsonl",".geojson",".xml",".csv",".tsv",".yaml",".yml",".sqlite",".db"]
  },
  source: {
    media:["texts","software"],
    ext:[".c",".cc",".cpp",".h",".hpp",".java",".go",".rs",".swift",".kt",".cs",".rb",".php",".sql"]
  },
  font: {
    media:["texts","software"],
    ext:[".ttf",".otf",".woff",".woff2"]
  }
};

// Deliberately excluded from RANDOM automatic downloads.
// Archives and source-code text are allowed, but directly executable/installable/script files are not.
const BLOCKED = [
  ".exe",".msi",".com",".scr",".bat",".cmd",".ps1",".vbs",
  ".app",".dmg",".pkg",".deb",".rpm",".apk",".ipa",
  ".sh",".bash",".zsh",".fish",".jar"
];

function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function esc(s){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])); }
function prettyBytes(n){
  n=Number(n||0);
  if(!n) return "unknown size";
  const u=["B","KB","MB","GB"]; let i=0;
  while(n>=1024&&i<u.length-1){n/=1024;i++;}
  return n.toFixed(i?1:0)+" "+u[i];
}

function selectedGroup(){
  const v=categoryEl.value;
  if(v!=="random") return {name:v,...GROUPS[v]};
  const name=pick(Object.keys(GROUPS));
  return {name,...GROUPS[name]};
}

function validFile(f,group,maxBytes){
  const name=(f.name||"").toLowerCase();
  const size=Number(f.size||0);
  if(!name) return false;
  if(BLOCKED.some(x=>name.endsWith(x))) return false;
  if(!group.ext.some(x=>name.endsWith(x))) return false;
  if(size && size>maxBytes) return false;
  if(name.includes("_meta.") || name.includes("_files.xml") || name.includes("__ia_thumb")) return false;
  if(String(f.private||"").toLowerCase()==="true") return false;
  if(String(f.restricted||"").toLowerCase()==="true") return false;
  return true;
}

async function searchPublicItem(group){
  const mediatype=pick(group.media);
  const page=1+Math.floor(Math.random()*100);
  const q=encodeURIComponent(`mediatype:${mediatype} AND -access-restricted-item:true`);
  const url=`https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier&rows=100&page=${page}&output=json`;
  const r=await fetch(url);
  if(!r.ok) throw new Error("Internet Archive search failed");
  const data=await r.json();
  const docs=data.response?.docs||[];
  if(!docs.length) throw new Error("No public items found");
  return pick(docs).identifier;
}

async function findFile(){
  const group=selectedGroup();
  const maxBytes=Number(maxSizeEl.value)*1024*1024;

  for(let attempt=1;attempt<=18;attempt++){
    statusEl.textContent=`Searching public ${group.name} files… ${attempt}/18`;
    const id=await searchPublicItem(group);

    const r=await fetch(`https://archive.org/metadata/${encodeURIComponent(id)}`);
    if(!r.ok) continue;
    const meta=await r.json();

    if(meta.is_dark===true) continue;
    if(String(meta.metadata?.["access-restricted-item"]||"").toLowerCase()==="true") continue;

    const candidates=(meta.files||[]).filter(f=>validFile(f,group,maxBytes));
    if(!candidates.length) continue;

    const file=pick(candidates);
    const path=file.name.split("/").map(encodeURIComponent).join("/");
    const original=`https://archive.org/download/${encodeURIComponent(id)}/${path}`;

    return {
      id,
      title:meta.metadata?.title||id,
      category:group.name,
      file,
      original
    };
  }

  throw new Error(`Couldn't find a public ${group.name} file. Click again.`);
}

function downloadThroughWorker(found){
  const worker=(window.RANDOM_FILE_CONFIG?.workerBaseUrl||"").replace(/\/$/,"");

  if(!worker){
    throw new Error("Forced-download backend is not configured yet. Deploy the Worker and paste its URL into config.js.");
  }

  const name=found.file.name.split("/").pop()||"random-file";
  const url=`${worker}/download?item=${encodeURIComponent(found.id)}&file=${encodeURIComponent(found.file.name)}&name=${encodeURIComponent(name)}`;

  // On macOS Chrome/Safari, navigating to a response with
  // Content-Disposition: attachment is more reliable than relying on
  // the cross-origin HTML `download` attribute.
  window.location.assign(url);
}

btn.addEventListener("click",async()=>{
  btn.disabled=true;
  resultEl.classList.add("hidden");

  try{
    const found=await findFile();

    resultEl.innerHTML=
      `<b>${esc(found.file.name)}</b><br>`+
      `Type: ${esc(found.category)}<br>`+
      `Archive item: ${esc(found.title)}<br>`+
      `Size: ${prettyBytes(found.file.size)}`;

    resultEl.classList.remove("hidden");
    statusEl.textContent="File found — macOS download starting…";
    downloadThroughWorker(found);
  }catch(err){
    statusEl.textContent=err.message||"Something went wrong.";
    btn.disabled=false;
  }
});
