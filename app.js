const btn = document.getElementById("downloadBtn");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const categoryEl = document.getElementById("category");
const maxSizeEl = document.getElementById("maxSize");

const GROUPS = {
    document: {
        media: ["texts"],
        ext: [".pdf", ".txt", ".md", ".rtf", ".epub", ".mobi", ".djvu", ".doc", ".docx", ".odt", ".pages"]
    },
    spreadsheet: {
        media: ["texts"],
        ext: [".csv", ".tsv", ".xls", ".xlsx", ".ods", ".numbers"]
    },
    presentation: {
        media: ["texts"],
        ext: [".ppt", ".pptx", ".odp", ".key"]
    },
    image: {
        media: ["image"],
        ext: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".tif", ".tiff", ".ico", ".heic"]
    },
    audio: {
        media: ["audio"],
        ext: [".mp3", ".ogg", ".wav", ".flac", ".m4a", ".aac", ".opus", ".aiff", ".wma"]
    },
    video: {
        media: ["movies"],
        ext: [".mp4", ".webm", ".mov", ".m4v", ".ogv", ".avi", ".mkv", ".mpeg", ".mpg"]
    },
    archive: {
        media: ["texts", "software"],
        ext: [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".tgz"]
    },
    web: {
        media: ["texts", "web"],
        ext: [".html", ".htm", ".css", ".xml", ".xhtml", ".mhtml"]
    },
    data: {
        media: ["texts"],
        ext: [".json", ".jsonl", ".geojson", ".xml", ".csv", ".tsv", ".yaml", ".yml", ".sqlite", ".db"]
    },
    source: {
        media: ["texts", "software"],
        ext: [".c", ".cc", ".cpp", ".h", ".hpp", ".java", ".go", ".rs", ".swift", ".kt", ".cs", ".rb", ".php", ".sql"]
    },
    font: {
        media: ["texts", "software"],
        ext: [".ttf", ".otf", ".woff", ".woff2"]
    }
};

const BLOCKED = [
    ".exe", ".msi", ".com", ".scr", ".bat", ".cmd", ".ps1", ".vbs",
    ".app", ".dmg", ".pkg", ".deb", ".rpm", ".apk", ".ipa",
    ".sh", ".bash", ".zsh", ".fish", ".jar"
];

const READY_TARGET = 4;
const PREFETCH_CONCURRENCY = 2;

let readyFiles = [];
let filling = false;
let generation = 0;

function pick(a)
{
    return a[Math.floor(Math.random() * a.length)];
}

function esc(s)
{
    return String(s).replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#039;"
    }[c]));
}

function prettyBytes(n)
{
    n = Number(n || 0);

    if (!n) return "unknown size";

    const units = ["B", "KB", "MB", "GB"];
    let i = 0;

    while (n >= 1024 && i < units.length - 1)
    {
        n /= 1024;
        i++;
    }

    return n.toFixed(i ? 1 : 0) + " " + units[i];
}

function currentSettings()
{
    return {
        category: categoryEl.value,
        maxSize: Number(maxSizeEl.value)
    };
}

function selectedGroup(settings)
{
    if (settings.category !== "random")
    {
        return {
            name: settings.category,
            ...GROUPS[settings.category]
        };
    }

    const name = pick(Object.keys(GROUPS));

    return {
        name,
        ...GROUPS[name]
    };
}

function validFile(f, group, maxBytes)
{
    const name = (f.name || "").toLowerCase();
    const size = Number(f.size || 0);

    if (!name) return false;
    if (BLOCKED.some(x => name.endsWith(x))) return false;
    if (!group.ext.some(x => name.endsWith(x))) return false;
    if (size && size > maxBytes) return false;

    if (
        name.includes("_meta.") ||
        name.includes("_files.xml") ||
        name.includes("__ia_thumb")
    )
    {
        return false;
    }

    if (String(f.private || "").toLowerCase() === "true") return false;
    if (String(f.restricted || "").toLowerCase() === "true") return false;

    return true;
}

async function searchPublicItem(group)
{
    const mediatype = pick(group.media);
    const page = 1 + Math.floor(Math.random() * 120);

    const q = encodeURIComponent(
        `mediatype:${mediatype} AND -access-restricted-item:true`
    );

    const url =
        `https://archive.org/advancedsearch.php?q=${q}` +
        `&fl[]=identifier&rows=100&page=${page}&output=json`;

    const r = await fetch(url, {
        cache: "no-store"
    });

    if (!r.ok)
    {
        throw new Error("Internet Archive search failed");
    }

    const data = await r.json();
    const docs = data.response?.docs || [];

    if (!docs.length)
    {
        throw new Error("No public items found");
    }

    return pick(docs).identifier;
}

async function findFile(settings)
{
    const group = selectedGroup(settings);
    const maxBytes = settings.maxSize * 1024 * 1024;

    for (let attempt = 1; attempt <= 12; attempt++)
    {
        const id = await searchPublicItem(group);

        const r = await fetch(
            `https://archive.org/metadata/${encodeURIComponent(id)}`,
            {
                cache: "no-store"
            }
        );

        if (!r.ok) continue;

        const meta = await r.json();

        if (meta.is_dark === true) continue;

        if (
            String(
                meta.metadata?.["access-restricted-item"] || ""
            ).toLowerCase() === "true"
        )
        {
            continue;
        }

        const candidates = (meta.files || []).filter(
            f => validFile(f, group, maxBytes)
        );

        if (!candidates.length) continue;

        const file = pick(candidates);

        return {
            id,
            title: meta.metadata?.title || id,
            category: group.name,
            file
        };
    }

    throw new Error(
        `Couldn't find a public ${group.name} file.`
    );
}

function sameFile(a, b)
{
    return (
        a.id === b.id &&
        a.file?.name === b.file?.name
    );
}

function addReadyFile(found, myGeneration)
{
    if (myGeneration !== generation) return;

    if (!readyFiles.some(x => sameFile(x, found)))
    {
        readyFiles.push(found);
    }
}

async function prefetchOne(settings, myGeneration)
{
    try
    {
        const found = await findFile(settings);
        addReadyFile(found, myGeneration);
    }
    catch (err)
    {
        console.warn("Prefetch failed:", err);
    }
}

async function fillQueue()
{
    if (filling) return;

    filling = true;

    const myGeneration = generation;
    const settings = currentSettings();

    try
    {
        while (
            myGeneration === generation &&
            readyFiles.length < READY_TARGET
        )
        {
            const missing =
                READY_TARGET - readyFiles.length;

            const amount = Math.min(
                PREFETCH_CONCURRENCY,
                missing
            );

            await Promise.all(
                Array.from(
                    { length: amount },
                    () => prefetchOne(
                        settings,
                        myGeneration
                    )
                )
            );

            if (
                myGeneration === generation &&
                readyFiles.length === 0
            )
            {
                await new Promise(
                    resolve => setTimeout(resolve, 700)
                );
            }
        }
    }
    finally
    {
        filling = false;

        if (
            myGeneration === generation &&
            readyFiles.length
        )
        {
            statusEl.textContent =
                `Ready — ${readyFiles.length} random file` +
                `${readyFiles.length === 1 ? "" : "s"} prepared.`;
        }
    }
}

function resetQueue()
{
    generation++;
    readyFiles = [];

    statusEl.textContent =
        "Preparing random files in the background…";

    fillQueue();
}

function showFound(found)
{
    resultEl.innerHTML =
        `<b>${esc(found.file.name)}</b><br>` +
        `Type: ${esc(found.category)}<br>` +
        `Archive item: ${esc(found.title)}<br>` +
        `Size: ${prettyBytes(found.file.size)}`;

    resultEl.classList.remove("hidden");
}

function downloadThroughWorker(found)
{
    const worker =
        (
            window.RANDOM_FILE_CONFIG?.workerBaseUrl ||
            ""
        ).replace(/\/$/, "");

    if (!worker)
    {
        throw new Error(
            "Forced-download backend is not configured. Check config.js."
        );
    }

    const name =
        found.file.name.split("/").pop() ||
        "random-file";

    const url =
        `${worker}/download` +
        `?item=${encodeURIComponent(found.id)}` +
        `&file=${encodeURIComponent(found.file.name)}` +
        `&name=${encodeURIComponent(name)}`;

    window.location.assign(url);
}

async function getReadyFile()
{
    if (readyFiles.length)
    {
        return readyFiles.shift();
    }

    statusEl.textContent =
        "No prefetched file ready yet — finding one now…";

    return await findFile(currentSettings());
}

btn.addEventListener("click", async () =>
{
    btn.disabled = true;
    resultEl.classList.add("hidden");

    try
    {
        const found = await getReadyFile();

        showFound(found);

        statusEl.textContent =
            "File ready — starting download…";

        setTimeout(fillQueue, 0);

        downloadThroughWorker(found);

        setTimeout(() =>
        {
            btn.disabled = false;

            if (readyFiles.length)
            {
                statusEl.textContent =
                    `Ready — ${readyFiles.length} random file` +
                    `${readyFiles.length === 1 ? "" : "s"} prepared.`;
            }
        }, 1200);
    }
    catch (err)
    {
        statusEl.textContent =
            err.message ||
            "Something went wrong.";

        btn.disabled = false;

        setTimeout(fillQueue, 1000);
    }
});

categoryEl.addEventListener(
    "change",
    resetQueue
);

maxSizeEl.addEventListener(
    "change",
    resetQueue
);

statusEl.textContent =
    "Preparing random files in the background…";

fillQueue();
