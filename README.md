# Random Internet File — Full Repo

A GitHub Pages frontend plus a Cloudflare Worker backend for downloading a random public file from Internet Archive.

## File variety

The random pool now includes many everyday file families:

- Documents: PDF, TXT, Markdown, EPUB, DOC/DOCX, ODT, Apple Pages, and more
- Spreadsheets: CSV, XLS/XLSX, ODS, Apple Numbers
- Presentations: PPT/PPTX, ODP, Apple Keynote
- Images: JPG, PNG, GIF, WEBP, SVG, TIFF, HEIC, etc.
- Audio and video
- Archives: ZIP, RAR, 7Z, TAR, GZ, BZ2, XZ
- Web pages: HTML, XHTML, MHTML, CSS, XML
- Data: JSON, YAML, SQLite/DB, GeoJSON, TSV
- Source-code text: C/C++, Java, Go, Rust, Swift, Kotlin, C#, PHP, SQL, etc.
- Fonts: TTF, OTF, WOFF/WOFF2

For safety, random executables, installers, disk images, shell scripts, and similar directly executable payloads are intentionally excluded.

## Why the Worker is required

GitHub Pages is static. A page cannot reliably force a cross-origin response from Internet Archive to download, especially when the browser decides a PDF/image/text file should be displayed.

The Worker fetches the public Internet Archive file and sends it back with:

```http
Content-Disposition: attachment
```

On macOS Chrome and Safari this is much more reliable because the browser receives an actual attachment response instead of an `<a download>` hint that may be ignored cross-origin.

## 1. Deploy GitHub Pages

Upload the repository contents to GitHub.

In the repository:

**Settings → Pages → Deploy from a branch → main → / (root)**

## 2. Deploy the Cloudflare Worker

Install Wrangler:

```bash
npm install -g wrangler
```

Log in:

```bash
wrangler login
```

Enter the worker folder:

```bash
cd worker
```

Deploy:

```bash
wrangler deploy
```

Wrangler gives you a URL similar to:

```text
https://random-internet-file-proxy.YOURNAME.workers.dev
```

## 3. Connect it to the website

Edit `config.js`:

```js
window.RANDOM_FILE_CONFIG = {
  workerBaseUrl: "https://random-internet-file-proxy.YOURNAME.workers.dev"
};
```

Commit and push.

After GitHub Pages updates, clicking the button will search Internet Archive, choose a public file, send the request through your Worker, and the Worker will return the file as an attachment.

## Repository files

```text
index.html
styles.css
app.js
config.js
README.md
LICENSE
CONTRIBUTING.md
CODE_OF_CONDUCT.md
SECURITY.md
.gitignore
worker/
  worker.js
  wrangler.jsonc
```

## License

MIT
