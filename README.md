# ADDY BUY Zebra Tool

Browser-based warehouse label printing and product lookup. No backend or React required.

## Local development

Use Node.js 22.12+ (Node 22 LTS recommended).

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
- vite.config.ts: Vite static build and preservation of asset paths.

## Migration phase 1

The approved stable and beta script/style bodies are extracted unchanged. Classic scripts retain their original execution order and scope; early startup remains inline. This avoids a framework rewrite and preserves existing storage keys and events. The toolchain is TypeScript-ready; the existing browser JavaScript is not yet converted to TypeScript. Future phases can split the larger feature files into typed modules with focused tests.

Run npm run verify:baseline once to reproduce the exact original approved HTML blobs. This check will intentionally fail after later feature edits. npm test checks local asset references, script parsing and manifest assets. npm run build additionally checks the static output.

## Deployment

The existing no-build Cloudflare Pages setup can still serve the repository directly during the transition. To enable Vite after beta approval, use build command npm run build and output directory dist, with Node 22. The existing URL and catalog paths do not need to change. Test a branch preview before changing production settings. Do not merge or promote until desktop and Android/iOS scanning, catalog import, label previews and real printer tests pass.

No service worker is added in this migration; existing local catalog behavior is preserved, not new offline guarantees.
