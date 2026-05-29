/**
 * Hydrated portfolio export budget (I-EXP-01).
 *
 * The `e2e-example.test.ts` budget assertion runs against
 * `PORTFOLIO_DOCUMENT` with `assets: {}` — the `optimize-images` stage
 * is a no-op, so the wall-clock number it produces is optimistic. The
 * spec's <10 s portfolio budget covers the *whole* pipeline including
 * variant packaging.
 *
 * This test hydrates the portfolio document with three assets (four
 * variant widths each), writes real WebP bytes to a temp dir via
 * `sharp`, stubs `window.electronAPI.readImageAssets` to read those
 * bytes off disk (mirroring the production IPC path), and runs the
 * heaviest realistic option set — `minify: true` + `inlineJS: true` —
 * against a fresh `createPortfolioTemplate('Ada Lovelace')`.
 *
 * The assertion is the same hard <10 s number from
 * `docs/0.2.0v/plan.md` Section 14 / `.claude/rules/testing.md`.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
import sharp from 'sharp'
import { createPortfolioTemplate } from '@templates/portfolio'
import { exportProject } from '@export/index'
import type { AssetManifestEntry, Document } from '@document/types'

interface HydratedAsset {
  id: string
  variants: ReadonlyArray<{ width: number; path: string; diskPath: string }>
  intrinsicWidth: number
  intrinsicHeight: number
}

const VARIANT_WIDTHS = [400, 800, 1200, 1600] as const

let workDir = ''
let hydratedAssets: HydratedAsset[] = []
let pathToDisk: Map<string, string> = new Map()

/**
 * Builds a small but realistic asset set: three images × four widths
 * each = 12 WebP files on disk. Sizes are picked low enough that sharp
 * stays fast; the goal is the pipeline shape, not large bytes.
 */
async function hydrateAssetsOnDisk(): Promise<void> {
  pathToDisk = new Map()
  hydratedAssets = []
  for (const id of ['hero', 'project-a', 'project-b']) {
    const intrinsicWidth = 1600
    const intrinsicHeight = 1067
    const variants: Array<{ width: number; path: string; diskPath: string }> = []
    for (const width of VARIANT_WIDTHS) {
      const path = `assets/${id}-${width}.webp`
      const height = Math.round(width * 0.6667)
      const diskPath = join(workDir, `${id}-${width}.webp`)
      const bytes = await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 32, g: 32, b: 64 },
        },
      })
        .webp({ quality: 70 })
        .toBuffer()
      await writeFile(diskPath, bytes)
      pathToDisk.set(path, diskPath)
      variants.push({ width, path, diskPath })
    }
    hydratedAssets.push({ id, variants, intrinsicWidth, intrinsicHeight })
  }
}

function manifestEntries(): Record<string, AssetManifestEntry> {
  const out: Record<string, AssetManifestEntry> = {}
  for (const asset of hydratedAssets) {
    const srcset: Record<number, string> = {}
    for (const v of asset.variants) srcset[v.width] = v.path
    out[asset.id] = {
      id: asset.id,
      mimeType: 'image/webp',
      originalFilename: `${asset.id}.png`,
      width: asset.intrinsicWidth,
      height: asset.intrinsicHeight,
      srcset,
    }
  }
  return out
}

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'dtw-budget-'))
  await hydrateAssetsOnDisk()
})

afterAll(async () => {
  vi.unstubAllGlobals()
  if (workDir.length > 0) await rm(workDir, { recursive: true, force: true })
})

describe('portfolio export budget (I-EXP-01) — hydrated assets', () => {
  it('packs every on-disk variant into the ZIP and finishes under 10 s', async () => {
    const doc: Document = {
      ...createPortfolioTemplate('Ada Lovelace'),
      assets: manifestEntries(),
    }

    let capturedBuffer: ArrayBuffer | null = null
    let readBatches = 0

    vi.stubGlobal('window', {
      electronAPI: {
        exportZip: vi.fn(async (buf: ArrayBuffer) => {
          capturedBuffer = buf
          return { success: true, filePath: join(workDir, 'portfolio.zip') }
        }),
        readImageAssets: vi.fn(async (paths: readonly string[]) => {
          readBatches += 1
          const out: Record<string, ArrayBuffer | null> = {}
          await Promise.all(
            paths.map(async (p) => {
              const disk = pathToDisk.get(p)
              if (!disk) {
                out[p] = null
                return
              }
              const buf = await readFile(disk)
              out[p] = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
            })
          )
          return out
        }),
      },
    })

    const t0 = performance.now()
    const result = await exportProject(doc, {
      projectName: 'portfolio',
      minify: true,
      inlineJS: true,
    })
    const elapsedMs = performance.now() - t0

    // eslint-disable-next-line no-console
    console.log(
      `[budget] hydrated portfolio (minify+inlineJS): ${elapsedMs.toFixed(0)}ms ` +
        `(budget <10000ms, ${VARIANT_WIDTHS.length * hydratedAssets.length} variants on disk)`
    )

    expect(result.success).toBe(true)
    expect(elapsedMs).toBeLessThan(10_000)
    // optimize-images batches every path into a single IPC call (dedupe + sort).
    expect(readBatches).toBe(1)

    // Verify the on-disk bytes actually landed in the ZIP — guards against
    // a silently no-op pipeline that would still "pass" the budget.
    expect(capturedBuffer).not.toBeNull()
    const zip = await JSZip.loadAsync(capturedBuffer!)
    for (const asset of hydratedAssets) {
      for (const v of asset.variants) {
        const entry = zip.file(v.path)
        expect(entry, `missing ZIP entry for ${v.path}`).not.toBeNull()
        const packedSize = (await entry!.async('uint8array')).byteLength
        expect(packedSize).toBeGreaterThan(0)
      }
    }
  }, 15_000)
})
