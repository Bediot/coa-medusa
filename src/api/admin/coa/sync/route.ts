import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { isSyncEnabled, resolvePluginConfig } from "../../../../lib/config"
import { syncAllProducts } from "../../../../lib/sync"

type SyncBody = {
  /** When true, only `status: published` products. Default false (all non-deleted). */
  published_only?: boolean
  /** Passed to `@bediot/coa` syncAll (capped at 250). */
  chunk_size?: number
}

/**
 * Bootstrap / reconcile: push the Medusa catalog to CoA.
 *
 * Authenticated Admin route — use from the CoA Admin UI or:
 * `POST /admin/coa/sync` with a session / bearer admin token.
 *
 * Prefer this over `medusa exec` for proof that HTTP + worker paths work;
 * the call itself uses `@bediot/coa` `syncAll` (direct HTTP to CoA).
 */
export async function POST(
  req: MedusaRequest<SyncBody>,
  res: MedusaResponse
): Promise<void> {
  const options = resolvePluginConfig()

  if (!isSyncEnabled(options)) {
    res.status(409).json({
      message:
        "CoA sync is disabled. Set COA_SYNC_ENABLED=true (or unset) on the worker.",
    })
    return
  }

  try {
    const result = await syncAllProducts(req.scope, {
      ...options,
      publishedOnly: Boolean(req.body?.published_only),
      chunkSize: req.body?.chunk_size,
    })

    if ("skipped" in result && result.skipped) {
      res.status(409).json({ message: result.reason })
      return
    }

    res.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(502).json({ message: `CoA sync failed: ${message}` })
  }
}

export async function GET(
  _req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const options = resolvePluginConfig()
  res.json({
    enabled: isSyncEnabled(options),
    api_key_configured: Boolean(options.apiKey),
    api_base: options.apiBase ?? "https://api.coa.sh (default)",
    sku_mode: options.skuMode,
    /** Sync resolves store from the API key; store id env is unused. */
    store_id_required: false,
  })
}
