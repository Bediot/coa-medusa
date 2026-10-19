import type { CoaProductInput, CoaVariantInput } from "./coa-sdk"

import type { CoaSkuMode } from "./config"

/** Minimal Medusa product graph shape used for CoA mapping. */
export type MedusaProductLike = {
  id: string
  title?: string | null
  handle?: string | null
  status?: string | null
  thumbnail?: string | null
  metadata?: Record<string, unknown> | null
  images?: Array<{ url?: string | null }> | null
  options?: Array<{ title?: string | null; values?: Array<{ value?: string | null }> | null }> | null
  variants?: Array<{
    id: string
    title?: string | null
    sku?: string | null
    variant_rank?: number | null
    options?: Array<{
      value?: string | null
      option?: { title?: string | null } | null
    }> | null
  }> | null
}

export type MapProductOptions = {
  imageBase?: string
  skuMode?: CoaSkuMode
}

function absoluteImageUrl(
  url: string | null | undefined,
  imageBase?: string
): string | undefined {
  if (!url || !url.trim()) return undefined
  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (!imageBase) return undefined
  const base = imageBase.replace(/\/+$/, "")
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
  return `${base}${path}`
}

function mapStatus(status: string | null | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "published":
      return "active"
    case "draft":
    case "proposed":
      return "draft"
    default:
      return "archived"
  }
}

function productSku(
  product: MedusaProductLike,
  skuMode: CoaSkuMode
): string | undefined {
  if (skuMode === "handle_only") return undefined

  const meta = product.metadata?.sku
  if (typeof meta === "string" && meta.trim()) {
    return meta.trim()
  }

  if (skuMode === "metadata") {
    const variants = (product.variants ?? []).filter(
      (v) => typeof v.sku === "string" && v.sku.trim()
    )
    if (variants.length === 1) {
      return variants[0].sku!.trim()
    }
    return undefined
  }

  if (skuMode === "sole_variant") {
    const variants = (product.variants ?? []).filter(
      (v) => typeof v.sku === "string" && v.sku.trim()
    )
    if (variants.length === 1) {
      return variants[0].sku!.trim()
    }
  }

  return undefined
}

function mapVariant(
  variant: NonNullable<MedusaProductLike["variants"]>[number]
): CoaVariantInput {
  const option_values: Record<string, string> = {}
  for (const opt of variant.options ?? []) {
    const title = opt.option?.title?.trim()
    const value = opt.value?.trim()
    if (title && value) {
      option_values[title] = value
    }
  }

  const input: CoaVariantInput = {
    id: variant.id,
    title: variant.title ?? undefined,
    position: variant.variant_rank ?? 0,
  }
  if (variant.sku?.trim()) {
    input.sku = variant.sku.trim()
  }
  if (Object.keys(option_values).length > 0) {
    input.option_values = option_values
  }
  return input
}

/**
 * Map a Medusa product (+ variants) to `@bediot/coa` `CoaProductInput`.
 *
 * Matching on CoA: SKU → handle/slug → platform id (`prod_…`).
 * Does **not** use Elements `metadata.wc_id` or other merchant-specific rematch keys.
 */
export function mapMedusaProductToCoa(
  product: MedusaProductLike,
  options: MapProductOptions = {}
): CoaProductInput {
  const skuMode = options.skuMode ?? "metadata"
  const image =
    absoluteImageUrl(product.thumbnail, options.imageBase) ??
    absoluteImageUrl(product.images?.[0]?.url, options.imageBase)

  const optionTitles = (product.options ?? [])
    .map((o) => o.title?.trim())
    .filter((t): t is string => Boolean(t))

  const variants = (product.variants ?? []).map(mapVariant)
  const sku = productSku(product, skuMode)

  const payload: CoaProductInput = {
    id: product.id,
    title: product.title ?? undefined,
    handle: product.handle ?? undefined,
    status: mapStatus(product.status),
  }

  if (sku) payload.sku = sku
  if (image) payload.image_url = image
  if (optionTitles.length) payload.options = optionTitles
  if (variants.length) payload.variants = variants

  return payload
}

/** Prefer SKU, then handle, then Medusa product id — for `trashProduct`. */
export function trashExternalId(product: {
  id: string
  handle?: string | null
  metadata?: Record<string, unknown> | null
  variants?: Array<{ sku?: string | null }> | null
}): string {
  const metaSku = product.metadata?.sku
  if (typeof metaSku === "string" && metaSku.trim()) {
    return metaSku.trim()
  }

  const variantSkus = (product.variants ?? [])
    .map((v) => v.sku?.trim())
    .filter((s): s is string => Boolean(s))
  if (variantSkus.length === 1) {
    return variantSkus[0]
  }

  if (product.handle?.trim()) {
    return product.handle.trim()
  }

  return product.id
}
