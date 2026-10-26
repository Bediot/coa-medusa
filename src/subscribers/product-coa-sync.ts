import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ProductWorkflowEvents } from "@medusajs/framework/utils"

import { debounceByKey } from "../lib/debounce"
import { isSyncEnabled, resolvePluginConfig } from "../lib/config"
import {
  syncProductById,
  trashProductById,
} from "../lib/sync"

/**
 * Continuous catalog push: Medusa product changes → CoA via `@bediot/coa`.
 *
 * Events (Medusa ≥2.8 workflow events, confirmed on 2.20):
 * - `product.created` / `product.updated` → `syncProduct`
 * - `product.deleted` → `trashProduct`
 *
 * Always re-fetches the product graph before mapping (payload is id-only).
 * Secrets: `COA_STORE_API_KEY` (+ optional `COA_API_BASE`) on the **worker** process.
 * Kill switch: `COA_SYNC_ENABLED=0`.
 *
 * Unpublish (`draft`) syncs status — does not trash. Hard delete trashes.
 */
export default async function productCoaSyncHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  const options = resolvePluginConfig()

  if (!isSyncEnabled(options)) {
    return
  }

  const productId = event.data?.id
  if (!productId) {
    logger.warn("coa-medusa: product event missing id")
    return
  }

  if (event.name === ProductWorkflowEvents.DELETED) {
    try {
      const result = await trashProductById(container, productId, options)
      if ("trashed" in result) {
        logger.info(
          `coa-medusa: trashed ${result.trashed} after product.deleted (${productId})`
        )
      }
    } catch (err) {
      logger.error(
        `coa-medusa: trash failed for ${productId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }
    return
  }

  const run = async () => {
    try {
      const result = await syncProductById(container, productId, options)
      if ("skipped" in result && result.skipped) {
        logger.info(
          `coa-medusa: skip sync ${productId}: ${result.reason}`
        )
        return
      }
      logger.info(
        `coa-medusa: synced ${productId} (${event.name}) products_synced=${
          "products_synced" in result ? result.products_synced : "?"
        }`
      )
    } catch (err) {
      logger.error(
        `coa-medusa: sync failed for ${productId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }
  }

  if (event.name === ProductWorkflowEvents.UPDATED) {
    debounceByKey(`coa-product:${productId}`, options.debounceMs, run)
    return
  }

  await run()
}

export const config: SubscriberConfig = {
  event: [
    ProductWorkflowEvents.CREATED,
    ProductWorkflowEvents.UPDATED,
    ProductWorkflowEvents.DELETED,
  ],
}
