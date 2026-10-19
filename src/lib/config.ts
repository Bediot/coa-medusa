import { createClient, type CoaClient, type CoaClientOptions } from "./coa-sdk"

export type CoaSkuMode = "metadata" | "sole_variant" | "handle_only"

export type CoaPluginOptions = {
  /** Override `COA_STORE_ID`. Prefer env on the worker. */
  storeId?: string | number
  /** Override `COA_STORE_API_KEY`. Prefer env on the worker — never ship to the storefront. */
  apiKey?: string
  /** Override `COA_API_BASE` (default https://api.coa.sh). */
  apiBase?: string
  /**
   * Kill switch. When false / `"0"` / `"false"`, subscribers and Admin sync no-op.
   * Env: `COA_SYNC_ENABLED` (default on when unset).
   */
  enabled?: boolean
  /**
   * Prefix for relative product thumbnails (`/images/…`).
   * Env: `COA_IMAGE_BASE`.
   */
  imageBase?: string
  /**
   * How to set product-level `sku` when mapping.
   * Env: `COA_PRODUCT_SKU_MODE` — default `metadata` (metadata → sole variant → omit).
   */
  skuMode?: CoaSkuMode
  /** In-process debounce for `product.updated` storms (ms). Default 2500. Env: `COA_SYNC_DEBOUNCE_MS`. */
  debounceMs?: number
}

function envFlag(name: string): boolean | undefined {
  const raw = process.env[name]
  if (raw === undefined || raw === "") return undefined
  const v = raw.trim().toLowerCase()
  if (v === "0" || v === "false" || v === "off" || v === "no") return false
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true
  return undefined
}

function parseSkuMode(raw: string | undefined): CoaSkuMode | undefined {
  if (!raw) return undefined
  if (raw === "metadata" || raw === "sole_variant" || raw === "handle_only") {
    return raw
  }
  return undefined
}

/** Resolve plugin options from medusa-config `plugins[].options` + env. */
export function resolvePluginConfig(
  options: CoaPluginOptions = {}
): Required<
  Pick<CoaPluginOptions, "enabled" | "skuMode" | "debounceMs">
> &
  CoaPluginOptions {
  const enabledEnv = envFlag("COA_SYNC_ENABLED")
  const enabled =
    options.enabled !== undefined
      ? options.enabled
      : enabledEnv !== undefined
        ? enabledEnv
        : true

  const skuMode =
    options.skuMode ??
    parseSkuMode(process.env.COA_PRODUCT_SKU_MODE) ??
    "metadata"

  const debounceRaw =
    options.debounceMs ??
    (process.env.COA_SYNC_DEBOUNCE_MS
      ? Number(process.env.COA_SYNC_DEBOUNCE_MS)
      : 2500)
  const debounceMs =
    Number.isFinite(debounceRaw) && debounceRaw >= 0 ? debounceRaw : 2500

  return {
    ...options,
    storeId: options.storeId ?? process.env.COA_STORE_ID,
    apiKey: options.apiKey ?? process.env.COA_STORE_API_KEY,
    apiBase: options.apiBase ?? process.env.COA_API_BASE,
    imageBase: options.imageBase ?? process.env.COA_IMAGE_BASE,
    enabled,
    skuMode,
    debounceMs,
  }
}

export function isSyncEnabled(options: CoaPluginOptions = {}): boolean {
  return resolvePluginConfig(options).enabled
}

/** Build a `@bediot/coa` client from plugin options / env. */
export function createCoaClientFromConfig(
  options: CoaPluginOptions = {}
): CoaClient {
  const cfg = resolvePluginConfig(options)
  const clientOpts: CoaClientOptions = {}
  if (cfg.storeId !== undefined && cfg.storeId !== "") {
    clientOpts.storeId = cfg.storeId
  }
  if (cfg.apiKey) clientOpts.apiKey = cfg.apiKey
  if (cfg.apiBase) clientOpts.apiBase = cfg.apiBase
  return createClient(clientOpts)
}
