import type { MedusaContainer } from "@medusajs/framework/types"
import type { SyncProductResult } from "./coa-sdk"

import {
  createCoaClientFromConfig,
  isSyncEnabled,
  resolvePluginConfig,
  type CoaPluginOptions,
} from "./config"
import { mapMedusaProductToCoa, trashExternalId } from "./map-product"
import { listProductsForCoa, retrieveProductForCoa } from "./product-query"

export async function syncProductById(
  container: MedusaContainer,
  productId: string,
  options: CoaPluginOptions = {}
): Promise<SyncProductResult | { skipped: true; reason: string }> {
  if (!isSyncEnabled(options)) {
    return { skipped: true, reason: "COA sync disabled" }
  }

  const product = await retrieveProductForCoa(container, productId)
  if (!product) {
    return { skipped: true, reason: `product ${productId} not found` }
  }

  const cfg = resolvePluginConfig(options)
  const client = createCoaClientFromConfig(cfg)
  const payload = mapMedusaProductToCoa(product, {
    imageBase: cfg.imageBase,
    skuMode: cfg.skuMode,
  })

  return client.syncProduct(payload)
}

export async function trashProductById(
  container: MedusaContainer,
  productId: string,
  options: CoaPluginOptions = {}
): Promise<{ skipped: true; reason: string } | { trashed: string }> {
  if (!isSyncEnabled(options)) {
    return { skipped: true, reason: "COA sync disabled" }
  }

  // Prefer identifiers from a last fetch when the row still exists (soft delete).
  // Hard delete may already have removed the row — fall back to platform id.
  const product = await retrieveProductForCoa(container, productId)
  const externalId = product
    ? trashExternalId(product)
    : productId

  const client = createCoaClientFromConfig(options)
  await client.trashProduct(externalId)
  return { trashed: externalId }
}

export async function syncAllProducts(
  container: MedusaContainer,
  options: CoaPluginOptions & {
    publishedOnly?: boolean
    chunkSize?: number
  } = {}
): Promise<
  | { skipped: true; reason: string }
  | {
      products_synced: number
      variants_synced: number
      listed: number
      status: string
    }
> {
  if (!isSyncEnabled(options)) {
    return { skipped: true, reason: "COA sync disabled" }
  }

  const cfg = resolvePluginConfig(options)
  const client = createCoaClientFromConfig(cfg)
  const pageSize = 100
  let skip = 0
  const all: ReturnType<typeof mapMedusaProductToCoa>[] = []

  for (;;) {
    const { products, count } = await listProductsForCoa(container, {
      take: pageSize,
      skip,
      publishedOnly: options.publishedOnly ?? false,
    })

    for (const product of products) {
      all.push(
        mapMedusaProductToCoa(product, {
          imageBase: cfg.imageBase,
          skuMode: cfg.skuMode,
        })
      )
    }

    skip += products.length
    if (products.length === 0 || skip >= count) {
      break
    }
  }

  if (all.length === 0) {
    return {
      status: "synced",
      products_synced: 0,
      variants_synced: 0,
      listed: 0,
    }
  }

  // Chunking / validation caps live in `@bediot/coa` syncAll (≤250).
  const result = await client.syncAll(all, {
    chunkSize: options.chunkSize ?? 100,
  })

  return {
    status: result.status,
    products_synced: result.products_synced,
    variants_synced: result.variants_synced,
    listed: all.length,
  }
}
