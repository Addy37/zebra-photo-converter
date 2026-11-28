# ADDY BUY Zebra Tool

Browser-based warehouse label printing and product lookup. No backend or React required.

## Local development

Use Node.js 22.13+ (Node 22 LTS recommended).

```sh
npm install
npm run dev
npm run check
npm run build
npm run preview
```

Open the development URL printed by Vite. Stable is at / and beta at /beta.html. Camera access requires localhost or HTTPS.

## Source map

- index.html and beta.html: markup, early theme and splash startup only.
- app/styles/application.css: common layout, responsive and print styles.
- app/styles/night-mode.css: theme overrides.
- app/styles/install.css: install prompt.
- app/features/label-and-photo.js: label rendering, barcode geometry, image conversion, batch jobs, print/share and device layout.
- app/services/catalog.js: IndexedDB, compressed CSV import, ranking, product lookup and catalog UI.
- app/features/scanner-and-product-search.js: camera, ZXing, OCR, scan feedback, product images and verification UI.
- app/features/install.js and install-beta.js: PWA installation instructions (variant-specific text).
- app/core/barcode.ts: UPC-A and Code 128 encoding and geometry.
- app/core/thermal.ts: pixel packing, monochrome conversion and photo dithering.
- app/core/catalog.ts: CSV parsing, search ranking and OCR candidate matching.
- app/runtime/: classic-script counterparts for no-build static hosting. Edit the TypeScript sources and run npm run generate:core; CI checks for drift.
- vite.config.ts: Vite static build and preservation of asset paths.

## Migration phase 1

The approved stable and beta script/style bodies are extracted unchanged. Classic scripts retain their original execution order and scope; early startup remains inline. This avoids a framework rewrite and preserves existing storage keys and events. The phase 1 source is preserved in commit af7463d78db8d51fa761081335c9ec0c8e3b6170.

## Migration phase 2 (typed core)

The barcode, thermal image and catalog matching algorithms now live in strictly checked TypeScript files. Classic browser entry scripts call those shared modules and keep their original initialization timing. The larger DOM controllers, printer bridge and IndexedDB orchestration remain JavaScript pending browser/device parity testing. No runtime dependencies or framework added.

The phase 1 byte-for-byte verification is historical and is no longer applicable after extracting functions. npm run check validates TypeScript, runtime parity and focused algorithm/structure tests. npm run build additionally checks the static output.

## Migration phase 3 (targeted catalog optimization)

Photo-only startup no longer builds the full in-memory catalog search cache. The existing IndexedDB catalog stays intact, and entering Product Search or focusing the search field prewarms the cache. Exact seven-digit manual SKU lookups use the IndexedDB primary key directly, with the original search as fallback. Search normalizes UPC once per query rather than once per product; exact UPC scans compare UPCs directly. The result ordering, limits, scan uniqueness rules and catalog version checks are retained. Scanner preparation is described below.

Run npm run benchmark for a repeatable 361,872-row synthetic CPU benchmark. It checks matching results and measures search-loop cost, not phone startup, physical scanning, actual database latency or browser memory. First-time catalog import still runs automatically and can take time. First broad search after opening the app may wait for cache preparation. No database migration or service worker introduced.

## Barcode scanner reliability

The ZXing browser distribution (0.1.5) is vendored under app/vendor/zxing with upstream licenses. It is prepared after initial page load from the same website, without a barcode-scanner CDN request. Native detection remains the first choice where supported. The browser regression test blocks jsDelivr and decodes an actual UPC image with the local library on Chromium and WebKit. Live physical camera scanning on iPhone remains a device acceptance test. The Tesseract OCR library, worker, WASM cores and English data are also vendored under app/vendor/ocr. After initial load, an idle callback loads ZXing and initializes a temporary OCR worker to populate the browser cache, then terminates it. No camera permission is requested. If a scanner is opened early it still works on demand; an in-progress OCR warmup is shared rather than starting duplicate workers. Browser cache persistence is browser-dependent. The full regression also decodes an actual model-number image with external CDNs blocked. The first visit may download several megabytes in the background.

## iOS scanner layout

The scanner dialog tracks Safari's visible viewport on iPhone and iPad, including resize and browser chrome changes. Inline playback is explicitly retained when the camera element is recreated. Existing Android and desktop styling is unchanged. Browser regression checks the dialog, video and both scan guide centers at iPhone 14 Pro Max dimensions and a shorter viewport, plus the existing Android and desktop profiles. These are geometry checks, not a physical camera preview test.

## Deployment

The existing no-build Cloudflare Pages setup can still serve the repository directly during the transition. To enable Vite after beta approval, use build command npm run build and output directory dist, with Node 22. The existing URL and catalog paths do not need to change. Test a branch preview before changing production settings. Do not merge or promote until desktop and Android/iOS scanning, catalog import, label previews and real printer tests pass.

No service worker is added in this migration; existing local catalog behavior is preserved, not new offline guarantees.

## Release version

Update package.json and the visible version in both HTML footers together for each release. Beta shows its channel explicitly. The structure test checks that both match the package version. This works with static hosting and Vite without a separate version request.
