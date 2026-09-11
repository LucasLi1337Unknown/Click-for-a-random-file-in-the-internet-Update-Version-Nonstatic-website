# Random Internet File

A fuller GitHub repository for a one-click random-file downloader.

## Architecture

- `index.html` — GitHub Pages UI
- `styles.css` — styling
- `app.js` — Internet Archive search + file selection
- `config.js` — optional backend URL
- `worker/worker.js` — optional Cloudflare Worker that proxies downloads and forces `Content-Disposition: attachment`
- `worker/wrangler.jsonc` — Worker config

## Why there is a Worker

GitHub Pages is static hosting. It cannot run server-side code or rewrite response headers from another website.

The site still works without the Worker by opening Internet Archive's direct `?download=1` URL. However, browsers and remote servers ultimately decide whether a cross-origin file is downloaded or displayed.

The optional Worker fetches the public Archive file server-side and returns it with:

`Content-Disposition: attachment`

That makes the browser treat the successful response as a download much more consistently.

## Deploy the GitHub Pages frontend

1. Upload `index.html`, `styles.css`, `app.js`, and `config.js` to the repository root.
2. GitHub → Settings → Pages.
3. Choose **Deploy from a branch**.
4. Select `main` and `/ (root)`.
5. Save.

## Optional: deploy the Cloudflare Worker

Install Wrangler:

```bash
npm install -g wrangler
```

Log in:

```bash
wrangler login
```

From the `worker` folder:

```bash
wrangler deploy
```

Wrangler will print a URL similar to:

```text
https://random-internet-file-proxy.YOURNAME.workers.dev
```

Copy that URL into `config.js`:

```js
window.RANDOM_FILE_CONFIG = {
  workerBaseUrl: "https://random-internet-file-proxy.YOURNAME.workers.dev"
};
```

Commit and push again.

## Safety

The repository intentionally blocks executables, scripts, installers, disk images, and archives. It is designed for random public documents, images, audio, video, and data files rather than random executable code.


## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Released under the MIT License. See [LICENSE](LICENSE).

## Security

See [SECURITY.md](SECURITY.md) for security reporting guidance.
