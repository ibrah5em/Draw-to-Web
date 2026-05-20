/**
 * Image upload pipeline (I-ELE-05, contract C11).
 *
 * Converts a raw image buffer (PNG, JPEG, WebP, GIF, or SVG) into the
 * `AssetManifestEntry` shape `document.assets` carries. Raster inputs are
 * re-encoded as WebP at 400/800/1200/1600 px widths — variants larger
 * than the source are skipped, and the source's intrinsic width is always
 * emitted if no target fits below it. SVG inputs pass through unchanged
 * with a single srcset entry derived from the source's `width` / `height`
 * attributes or `viewBox`.
 *
 * Variants are written to `<outputDir>/<id>-<width>.webp` (or
 * `<id>.svg`). The manifest's `srcset` records the *export-relative* path
 * (`assets/<id>-<width>.webp`) so the generator can splice it straight
 * into an `<img srcset>` attribute without translation.
 */

import sharp from 'sharp'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { nanoid } from 'nanoid'
import type { AssetManifestEntry } from '../document/types'

/** Target widths emitted as WebP variants when the source is wider. */
const TARGET_WIDTHS = [400, 800, 1200, 1600] as const

/** WebP quality factor (libvips default is 75; 82 keeps photo grain). */
const WEBP_QUALITY = 82

/** Fallback dimension when an SVG declares neither width/height nor viewBox. */
const SVG_FALLBACK_DIMENSION = 1600

/**
 * Pulls intrinsic pixel dimensions out of an SVG's root `<svg>` tag. Prefers
 * explicit `width`/`height` attributes; falls back to the viewBox's last
 * two coordinates. Returns `SVG_FALLBACK_DIMENSION` on either axis when no
 * declaration is present so the manifest always carries a usable size.
 */
function readSvgDimensions(buffer: Buffer): { width: number; height: number } {
  const head = buffer.subarray(0, Math.min(buffer.length, 2048)).toString('utf8')
  const widthAttr = head.match(/<svg[^>]*\swidth\s*=\s*["']([\d.]+)/i)
  const heightAttr = head.match(/<svg[^>]*\sheight\s*=\s*["']([\d.]+)/i)
  const viewBox = head.match(/viewBox\s*=\s*["']\s*[\d.+-]+\s+[\d.+-]+\s+([\d.]+)\s+([\d.]+)/i)
  const w = widthAttr ? Number(widthAttr[1]) : viewBox ? Number(viewBox[1]) : NaN
  const h = heightAttr ? Number(heightAttr[1]) : viewBox ? Number(viewBox[2]) : NaN
  return {
    width: Number.isFinite(w) && w > 0 ? Math.round(w) : SVG_FALLBACK_DIMENSION,
    height: Number.isFinite(h) && h > 0 ? Math.round(h) : SVG_FALLBACK_DIMENSION,
  }
}

/**
 * Process an image buffer into on-disk variants and return the manifest
 * entry. Throws if the input cannot be decoded as a valid image — the
 * IPC handler converts that into a structured `{ success: false }` reply.
 *
 * @param buffer - The raw image bytes (already MIME-sniffed by the caller).
 * @param mimeType - Canonical MIME (`image/png` | `image/jpeg` | `image/webp` | `image/gif` | `image/svg+xml`).
 * @param originalFilename - The author-supplied name, surfaced in the UI for alt-text suggestions; not used on disk.
 * @param outputDir - Absolute directory the variants are written to. Created if missing.
 * @returns The manifest entry suitable for `document.assets[entry.id] = entry`.
 */
export async function processImage(
  buffer: Buffer,
  mimeType: string,
  originalFilename: string,
  outputDir: string
): Promise<AssetManifestEntry> {
  await mkdir(outputDir, { recursive: true })
  const id = nanoid()

  if (mimeType === 'image/svg+xml') {
    const { width, height } = readSvgDimensions(buffer)
    await writeFile(join(outputDir, `${id}.svg`), buffer)
    return {
      id,
      mimeType,
      originalFilename,
      width,
      height,
      srcset: { [width]: `assets/${id}.svg` },
    }
  }

  const metadata = await sharp(buffer).metadata()
  const srcWidth = metadata.width ?? 0
  const srcHeight = metadata.height ?? 0
  if (srcWidth <= 0 || srcHeight <= 0) {
    throw new Error('Image has invalid dimensions')
  }

  // Keep every target that fits the source. For sources that fall *between*
  // two targets (e.g. 600 px — 400 fits, 800 does not), append the source
  // width too so we don't throw away resolution. For sources smaller than
  // the smallest target, emit a single variant at the source's own width.
  const LARGEST_TARGET = TARGET_WIDTHS[TARGET_WIDTHS.length - 1]
  const widths = TARGET_WIDTHS.filter((w) => w <= srcWidth)
  if (widths.length === 0) {
    widths.push(srcWidth)
  } else if (widths[widths.length - 1] < srcWidth && srcWidth < LARGEST_TARGET) {
    widths.push(srcWidth)
  }

  const srcset: Record<number, string> = {}
  for (const width of widths) {
    const variant = await sharp(buffer)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer()
    await writeFile(join(outputDir, `${id}-${width}.webp`), variant)
    srcset[width] = `assets/${id}-${width}.webp`
  }

  return {
    id,
    mimeType,
    originalFilename,
    width: srcWidth,
    height: srcHeight,
    srcset,
  }
}

/** Directory name under `userData` that holds processed image variants. */
export const IMAGE_ASSETS_DIRNAME = 'dtw-assets'
