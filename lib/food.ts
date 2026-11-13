import type { ExtraFood } from './week'

// Browser helpers for logging food by photo or barcode.

/** A food with the amount its numbers are for, so the amount can be corrected before it is saved. */
export interface Portion extends ExtraFood {
  grams: number
}

/** The same food for another amount. */
export function scalePortion(portion: Portion, grams: number, unit: string): ExtraFood {
  const scale = (value: number) => Math.round((value * grams) / portion.grams)
  return {
    name: `${portion.name}, ${grams} ${unit}`.slice(0, 120),
    calories: scale(portion.calories),
    protein: scale(portion.protein),
    carbs: scale(portion.carbs),
    fats: scale(portion.fats),
  }
}

/** Shrinks a photo so it is quick to send; null when the file is not a readable image. */
export async function photoToDataUrl(file: File, maxSide = 800): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.7)
  } catch {
    return null
  }
}

/** The barcode in a photo, where the browser can read barcodes (Chrome on Android and desktop); otherwise null. */
export async function readBarcode(file: File): Promise<string | null> {
  const Detector = (window as any).BarcodeDetector
  if (!Detector) return null
  try {
    const codes = await new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }).detect(await createImageBitmap(file))
    return codes[0]?.rawValue || null
  } catch {
    return null
  }
}

export const isBarcode = (text: string) => /^\d{8,14}$/.test(text.trim())

/** Looks a packaged product up in the open Open Food Facts database; null when it is not there. */
export async function lookupBarcode(code: string): Promise<Portion | null> {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code.trim())}.json?fields=product_name,brands,nutriments,serving_quantity`
    )
    const product = (await response.json())?.product
    const per100 = (key: string) => Math.max(0, Number(product?.nutriments?.[`${key}_100g`]) || 0)
    const calories = per100('energy-kcal')
    if (!calories) return null
    const grams = Math.round(Number(product.serving_quantity)) || 100
    const portion: Portion = {
      name: String(product.product_name || product.brands || code).slice(0, 80),
      grams: 100,
      calories,
      protein: per100('proteins'),
      carbs: per100('carbohydrates'),
      fats: per100('fat'),
    }
    // Start from one serving when the package states it.
    return { ...portion, ...scalePortion(portion, grams, ''), name: portion.name, grams }
  } catch {
    return null
  }
}
