# Knotebook store

Static storefront for [Knotebook](https://github.com/michael-borck/knotebook) packs.
No backend. `catalogue.json` and the packs are served as static files.

## What lives here

```
catalogue.json           signed list of packs (hashes + signatures)
packs/*.knotebook.json   the packs themselves
index.html               storefront
style.css, app.js        storefront assets
scripts/verify-store.mjs hash + signature check used by CI
```

## Rebuilding the catalogue

The catalogue is built and signed **locally**, not in CI, so the private key never
leaves the maintainer's machine. From the main Knotebook repo:

```bash
npm run store:build -- \
  --dir ../knotebook-store/packs \
  --base packs/ \
  --key keys/store-secret.txt \
  --out ../knotebook-store/catalogue.json
```

Copy reviewed, signed packs into `packs/` first. The pack bytes must not change
after signing.

## Verify

```bash
node scripts/verify-store.mjs
```

CI runs this before deploying. It checks every pack's SHA-256 and, when the
catalogue has a `publicKey`, its Ed25519 signature. It also checks the catalogue
version, pack metadata, data-URL assets, and the 16 MB pack limit.

## Deploy

`.github/workflows/deploy.yml` deploys this repo to GitHub Pages on push to
`main`. Enable Pages with the GitHub Actions source once.

## Player

`index.html` links to the Knotebook Player with:

```
<player-url>?player=1&store=<absolute catalogue URL>
```

Set `PLAYER_URL` in `app.js` if the app is hosted elsewhere.

The storefront has a theme filter bar and a strict CSP; its script and styles are
external files (`app.js`, `style.css`).
