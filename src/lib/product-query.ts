import type { MedusaContainer } from "@medusajs/framework/types"

import type { MedusaProductLike } from "./map-product"

const PRODUCT_FIELDS = [
  "id",
  "title",
  "handle",
  "status",
  "thumbnail",
  "metadata",
  "images.url",
  "options.title",
  "variants.id",
  "variants.title",
  "variants.sku",
  "variants.variant_rank",
  "variants.options.value",
  "variants.options.option.title",
] as const

export async function retrieveProductForCoa(
  container: MedusaContainer,
  productId: string
): Promise<MedusaProductLike | null> {
  const query = container.resolve("query")
  const { data } = await query.graph({
    entity: "product",
    filters: { id: productId },
    fields: [...PRODUCT_FIELDS],
  })

  const product = data?.[0] as MedusaProductLike | undefined
  return product ?? null
}

export async function listProductsForCoa(
  container: MedusaContainer,
  options: { take?: number; skip?: number; publishedOnly?: boolean } = {}
): Promise<{ products: MedusaProductLike[]; count: number }> {
  const take = Math.min(Math.max(options.take ?? 100, 1), 250)
  const skip = Math.max(options.skip ?? 0, 0)
  const query = container.resolve("query")

  const filters: Record<string, unknown> = {}
  if (options.publishedOnly) {
    filters.status = "published"
  }

  const { data, metadata } = await query.graph({
    entity: "product",
    filters,
    fields: [...PRODUCT_FIELDS],
    pagination: { take, skip },
  })

  return {
    products: (data ?? []) as MedusaProductLike[],
    count: metadata?.count ?? data?.length ?? 0,
  }
}
