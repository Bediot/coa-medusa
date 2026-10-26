# `@bediot/coa-medusa`

Medusa v2 plugin that **pushes** your product catalog to [CoA](https://coa.sh).

Depends on [`@bediot/coa`](https://www.npmjs.com/package/@bediot/coa) for all HTTP sync (`createClient`, `syncProduct`, `trashProduct`, `syncAll`). This package only wires Medusa: product → payload mapping, subscribers, and an Admin bootstrap UI/API.

There is **no** Admin marketplace click-install (WordPress-style). Self-hosted and **Medusa Cloud** both need a package install, a `plugins` entry, env vars, and a redeploy.

## Install

```bash
npm i @bediot/coa-medusa
# or: pnpm add @bediot/coa-medusa
```

### 1. Register the plugin

```ts
// medusa-config.ts
module.exports = defineConfig({
  // ...
  plugins: [
    {
      resolve: "@bediot/coa-medusa",
      options: {},
    },
  ],
})
```

### 2. Environment (worker)

Set these on the process that runs **subscribers and jobs** (`MEDUSA_WORKER_MODE=worker` or `shared`). Secrets on `server`-only silently no-op sync.

| Variable | Required | Notes |
|----------|----------|--------|
| `COA_STORE_API_KEY` | yes | Workspace key `coa_ct_…` — **never** `NEXT_PUBLIC_*`. Store is resolved from the key (1:1). |
| `COA_API_BASE` | no | Default `https://api.coa.sh` |
| `COA_STORE_ID` | no | Optional legacy only. Sync does **not** need it. Storefront embeds still use `NEXT_PUBLIC_COA_STORE_ID` (public short id). |
| `COA_SYNC_ENABLED` | no | Kill switch: `0` / `false` skips subscribers + Admin sync |
| `COA_IMAGE_BASE` | no | Prefix for relative thumbnails (`/images/…` → absolute URL) |
| `COA_PRODUCT_SKU_MODE` | no | `metadata` (default) \| `sole_variant` \| `handle_only` |
| `COA_SYNC_DEBOUNCE_MS` | no | Debounce `product.updated` storms (default `2500`) |

### 3. Redeploy

Commit, push, and redeploy so the worker picks up the plugin + env.

### 4. Bootstrap once

In Medusa Admin open **CoA sync** (sidebar) → **Sync catalog to CoA**, or:

```bash
curl -X POST "$MEDUSA_BACKEND_URL/admin/coa/sync" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"published_only":false}'
```

Continuous sync then runs on `product.created` / `product.updated` / `product.deleted`.

---

## Self-hosted (e.g. Railway)

1. `pnpm add @bediot/coa-medusa` in the Medusa app.
2. Add the `plugins` entry above.
3. Set `COA_*` on the **worker** service (and shared locally).
4. Deploy, then run Admin sync once.

## Medusa Cloud

Same as self-hosted — Cloud is not a plugin marketplace:

1. Add the dependency + `plugins` entry in the **linked GitHub** repo.
2. Set `COA_*` in the Cloud environment variables UI (`mcloud` / dashboard). Mark **Runtime** for subscriber reads.
3. Redeploy from that commit.
4. Open Admin → **CoA sync** (or `POST /admin/coa/sync`).

Ops cannot finish install with env-only changes if the package is not in the repo yet.

---

## How it works

```text
Admin edit / API write
        │
        ▼
product.created | product.updated | product.deleted
        │  (Redis event bus → worker subscriber)
        ▼
map Medusa product → CoaProductInput
        │
        ▼
@bediot/coa  syncProduct / trashProduct
        │
        ▼
CoA catalog (SKU → handle → platform id)
```

| Mode | Mechanism |
|------|-----------|
| Continuous | Subscribers on workflow events `product.created`, `product.updated`, `product.deleted` |
| Bootstrap | Admin UI or `POST /admin/coa/sync` → `syncAll` (chunks ≤250 inside `@bediot/coa`) |

**Unpublish** (`draft`): syncs `status: "draft"` — does not trash.  
**Hard delete**: `trashProduct` (soft trash on CoA; blocked while certificates are assigned).

### Mapping defaults

- `id` → Medusa `product.id` (`prod_…`)
- Product `sku` → `metadata.sku`, else sole variant SKU, else omit (match on handle)
- `handle` → `product.handle`
- Variants → full authoritative set with `variant.sku`
- `image_url` → absolute `thumbnail` / first image (`COA_IMAGE_BASE` for relative paths)
- Status → `published`→`active`, `draft`/`proposed`→`draft`, else `archived`

No WooCommerce `wc_id` rematch in this package.

---

## Local development against a Medusa app

```bash
# in this repo
npm i
npx medusa plugin:publish
npx medusa plugin:develop

# in your Medusa app
npx medusa plugin:add @bediot/coa-medusa
# register plugins entry, set COA_*, npm run dev
```

Or temporarily: `"@bediot/coa-medusa": "file:../coa-medusa"` (do not publish with `file:` deps — this package already depends on `@bediot/coa` from npm).

Prove subscribers with a real Admin product save (not `medusa exec` alone — the event bus flushes at end of an HTTP request).

---

## Docs recipe (no plugin)

If you cannot install plugins, call `createClient()` from `@bediot/coa` in your own `src/subscribers/` using the same mapping rules. Prefer this package so mapping does not drift.

## License

MIT © Bediot
