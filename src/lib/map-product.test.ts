import { describe, expect, it } from "vitest"

import { mapMedusaProductToCoa, trashExternalId } from "./map-product"

describe("mapMedusaProductToCoa", () => {
  it("maps published product with sole-variant SKU to product sku", () => {
    const payload = mapMedusaProductToCoa({
      id: "prod_01ABC",
      title: "BPC-157",
      handle: "bpc-157",
      status: "published",
      thumbnail: "https://cdn.example/bpc.jpg",
      options: [{ title: "Dosage" }],
      variants: [
        {
          id: "variant_1",
          title: "10mg",
          sku: "ED-BPC157-10MG",
          variant_rank: 0,
          options: [{ value: "10mg", option: { title: "Dosage" } }],
        },
      ],
    })

    expect(payload).toEqual({
      id: "prod_01ABC",
      title: "BPC-157",
      handle: "bpc-157",
      status: "active",
      sku: "ED-BPC157-10MG",
      image_url: "https://cdn.example/bpc.jpg",
      options: ["Dosage"],
      variants: [
        {
          id: "variant_1",
          title: "10mg",
          sku: "ED-BPC157-10MG",
          position: 0,
          option_values: { Dosage: "10mg" },
        },
      ],
    })
  })

  it("omits product sku for multi-variant when metadata.sku unset", () => {
    const payload = mapMedusaProductToCoa({
      id: "prod_MULTI",
      title: "Retatrutide",
      handle: "retatrutide",
      status: "published",
      variants: [
        { id: "v1", sku: "ED-RETA-10MG", title: "10mg" },
        { id: "v2", sku: "ED-RETA-20MG", title: "20mg" },
      ],
    })

    expect(payload.sku).toBeUndefined()
    expect(payload.handle).toBe("retatrutide")
    expect(payload.variants).toHaveLength(2)
  })

  it("prefers metadata.sku over sole variant", () => {
    const payload = mapMedusaProductToCoa({
      id: "prod_META",
      title: "Water",
      handle: "bac-water",
      status: "draft",
      metadata: { sku: "PRODUCT-SKU" },
      variants: [{ id: "v1", sku: "VARIANT-SKU", title: "default" }],
    })

    expect(payload.sku).toBe("PRODUCT-SKU")
    expect(payload.status).toBe("draft")
  })

  it("prefixes relative thumbnails when imageBase set", () => {
    const payload = mapMedusaProductToCoa(
      {
        id: "prod_REL",
        title: "X",
        handle: "x",
        status: "published",
        thumbnail: "/images/x.jpg",
      },
      { imageBase: "https://shop.example" }
    )

    expect(payload.image_url).toBe("https://shop.example/images/x.jpg")
  })

  it("does not invent sku from handle or wc_id", () => {
    const payload = mapMedusaProductToCoa({
      id: "prod_WC",
      title: "Legacy",
      handle: "legacy",
      status: "published",
      metadata: { wc_id: 12345 },
      variants: [
        { id: "v1", sku: "A", title: "a" },
        { id: "v2", sku: "B", title: "b" },
      ],
    })

    expect(payload.sku).toBeUndefined()
    expect(payload).not.toHaveProperty("wc_id")
    expect(JSON.stringify(payload)).not.toContain("12345")
  })

  it("handle_only skuMode never sets product sku", () => {
    const payload = mapMedusaProductToCoa(
      {
        id: "prod_H",
        title: "H",
        handle: "h",
        status: "published",
        metadata: { sku: "SHOULD-IGNORE" },
        variants: [{ id: "v1", sku: "SOLE", title: "default" }],
      },
      { skuMode: "handle_only" }
    )

    expect(payload.sku).toBeUndefined()
  })
})

describe("trashExternalId", () => {
  it("prefers metadata sku, then sole variant, then handle, then id", () => {
    expect(
      trashExternalId({
        id: "prod_1",
        handle: "h",
        metadata: { sku: "META" },
        variants: [{ sku: "V" }],
      })
    ).toBe("META")

    expect(
      trashExternalId({
        id: "prod_1",
        handle: "h",
        variants: [{ sku: "ONLY" }],
      })
    ).toBe("ONLY")

    expect(
      trashExternalId({
        id: "prod_1",
        handle: "my-handle",
        variants: [{ sku: "A" }, { sku: "B" }],
      })
    ).toBe("my-handle")

    expect(trashExternalId({ id: "prod_ONLY" })).toBe("prod_ONLY")
  })
})
