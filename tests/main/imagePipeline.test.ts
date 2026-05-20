import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readFile, readdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import sharp from 'sharp'
import { processImage } from '../../src/main/imagePipeline'

let tempDir: string

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'dtw-image-'))
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

/** Build an in-memory PNG of the given size, filled with a solid color. */
async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 80, b: 40 },
    },
  })
    .png()
    .toBuffer()
}

describe('processImage — raster pipeline', () => {
  it('emits all four target widths when the source is larger', async () => {
    const png = await makePng(2400, 1600)
    const entry = await processImage(png, 'image/png', 'hero.png', tempDir)

    expect(entry.width).toBe(2400)
    expect(entry.height).toBe(1600)
    expect(entry.originalFilename).toBe('hero.png')
    expect(entry.mimeType).toBe('image/png')
    expect(
      Object.keys(entry.srcset)
        .map(Number)
        .sort((a, b) => a - b)
    ).toEqual([400, 800, 1200, 1600])

    for (const [w, relPath] of Object.entries(entry.srcset)) {
      expect(relPath).toBe(`assets/${entry.id}-${w}.webp`)
      const fileBytes = await readFile(join(tempDir, `${entry.id}-${w}.webp`))
      const meta = await sharp(fileBytes).metadata()
      expect(meta.format).toBe('webp')
      expect(meta.width).toBe(Number(w))
    }
  })

  it('skips variants larger than the source and emits source-width fallback', async () => {
    const png = await makePng(600, 400)
    const entry = await processImage(png, 'image/png', 'small.png', tempDir)

    // 800/1200/1600 are too wide → only 400 + the source width 600 remain.
    expect(
      Object.keys(entry.srcset)
        .map(Number)
        .sort((a, b) => a - b)
    ).toEqual([400, 600])
    expect(entry.width).toBe(600)
  })

  it('always emits at least one variant for tiny sources', async () => {
    const png = await makePng(120, 80)
    const entry = await processImage(png, 'image/png', 'thumb.png', tempDir)

    expect(Object.keys(entry.srcset)).toHaveLength(1)
    expect(entry.srcset[120]).toBe(`assets/${entry.id}-120.webp`)
  })

  it('throws on a buffer sharp cannot decode', async () => {
    const garbage = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00])
    await expect(processImage(garbage, 'image/png', 'broken.png', tempDir)).rejects.toThrow()
  })

  it('writes only the intended files to the output directory', async () => {
    const png = await makePng(800, 600)
    const entry = await processImage(png, 'image/png', 'mid.png', tempDir)

    const onDisk = (await readdir(tempDir)).sort()
    const expected = Object.keys(entry.srcset)
      .map((w) => `${entry.id}-${w}.webp`)
      .sort()
    expect(onDisk).toEqual(expected)
  })
})

describe('processImage — SVG passthrough', () => {
  it('preserves SVG bytes and reads width/height attributes', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="red"/></svg>'
    )
    const entry = await processImage(svg, 'image/svg+xml', 'logo.svg', tempDir)

    expect(entry.width).toBe(320)
    expect(entry.height).toBe(180)
    expect(entry.srcset).toEqual({ 320: `assets/${entry.id}.svg` })
    const written = await readFile(join(tempDir, `${entry.id}.svg`))
    expect(written.equals(svg)).toBe(true)
  })

  it('falls back to viewBox when width/height attrs are absent', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"><rect width="64" height="48"/></svg>'
    )
    const entry = await processImage(svg, 'image/svg+xml', 'vb.svg', tempDir)
    expect(entry.width).toBe(64)
    expect(entry.height).toBe(48)
  })

  it('falls back to a 1600px sentinel when neither attrs nor viewBox declare a size', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1"/></svg>')
    const entry = await processImage(svg, 'image/svg+xml', 'bare.svg', tempDir)
    expect(entry.width).toBe(1600)
    expect(entry.height).toBe(1600)
  })
})
