/**
 * Bridge for Medusa plugin CJS output → `@bediot/coa` (dual ESM/CJS package).
 *
 * Runtime loads the published `require` export (`dist/index.cjs`).
 * Types come from the package; sync/trash/chunking stay in `@bediot/coa`.
 */
import { createRequire } from "node:module"

import type {
  CoaClient,
  CoaClientOptions,
  CoaProductInput,
  CoaVariantInput,
  SyncProductResult,
  TrashProductResult,
} from "@bediot/coa" with { "resolution-mode": "require" }

const nodeRequire = createRequire(__filename)
const coa = nodeRequire("@bediot/coa") as {
  createClient: (options?: CoaClientOptions) => CoaClient
}

export const createClient = coa.createClient

export type {
  CoaClient,
  CoaClientOptions,
  CoaProductInput,
  CoaVariantInput,
  SyncProductResult,
  TrashProductResult,
}
