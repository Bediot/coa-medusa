import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"

type StatusResponse = {
  enabled: boolean
  store_configured: boolean
  api_key_configured: boolean
  api_base: string
  sku_mode: string
}

type SyncResponse = {
  status?: string
  products_synced?: number
  variants_synced?: number
  listed?: number
  message?: string
}

const CoaSyncPage = () => {
  const [publishedOnly, setPublishedOnly] = useState(false)

  const statusQuery = useQuery({
    queryKey: ["coa-sync-status"],
    queryFn: async (): Promise<StatusResponse> => {
      const res = await fetch("/admin/coa/sync", { credentials: "include" })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(payload?.message ?? "Could not read CoA sync status.")
      }
      return payload as StatusResponse
    },
  })

  const syncMutation = useMutation({
    mutationFn: async (): Promise<SyncResponse> => {
      const res = await fetch("/admin/coa/sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published_only: publishedOnly }),
      })
      const payload = (await res.json().catch(() => null)) as SyncResponse | null
      if (!res.ok) {
        throw new Error(payload?.message ?? "CoA sync failed.")
      }
      return payload ?? {}
    },
    onSuccess: (data) => {
      toast.success("Synced to CoA", {
        description: `${data.products_synced ?? 0} products · ${
          data.variants_synced ?? 0
        } variants (listed ${data.listed ?? 0})`,
      })
    },
    onError: (err: unknown) => {
      toast.error("Sync failed", {
        description: err instanceof Error ? err.message : String(err),
      })
    },
  })

  const status = statusQuery.data

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">CoA catalog sync</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Push Medusa products into your CoA store. Continuous sync runs on
            product create/update/delete via the worker; use this for bootstrap
            or recovery.
          </Text>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-6 py-4">
        {statusQuery.isLoading && (
          <Text size="small">Checking configuration…</Text>
        )}
        {statusQuery.isError && (
          <Text size="small" className="text-ui-fg-error">
            {statusQuery.error instanceof Error
              ? statusQuery.error.message
              : "Status unavailable"}
          </Text>
        )}
        {status && (
          <div className="flex flex-col gap-1 text-ui-fg-subtle">
            <Text size="small">
              Sync {status.enabled ? "enabled" : "disabled"} · store{" "}
              {status.store_configured ? "set" : "missing"} · API key{" "}
              {status.api_key_configured ? "set" : "missing"}
            </Text>
            <Text size="small">
              API {status.api_base} · SKU mode {status.sku_mode}
            </Text>
          </div>
        )}

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={publishedOnly}
            onChange={(e) => setPublishedOnly(e.target.checked)}
          />
          <Text size="small">Published products only</Text>
        </label>

        <div>
          <Button
            onClick={() => syncMutation.mutate()}
            isLoading={syncMutation.isPending}
            disabled={status?.enabled === false}
          >
            Sync catalog to CoA
          </Button>
        </div>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "CoA sync",
})

export default CoaSyncPage
