/**
 * Draw-to-Web MCP server — stdio entry point.
 *
 * Runs headless (no Electron, no UI): installs the `fs`-backed export save
 * seam, builds the {@link Workspace} session store, registers the tools +
 * resources via {@link createServer}, and speaks MCP over stdio.
 *
 * Document `.dtw` files and exported ZIP bundles are written under
 * `DTW_MCP_DIR` (default `<cwd>/.dtw-mcp`).
 *
 * Run with:  `vite-node mcp/server.ts`
 */

import { join } from 'node:path'

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { createServer } from './createServer'
import { installExportShim } from './electronShim'
import { Workspace } from './session'

async function main(): Promise<void> {
  const baseDir = process.env.DTW_MCP_DIR ?? join(process.cwd(), '.dtw-mcp')
  installExportShim(baseDir)
  const workspace = new Workspace(baseDir)
  const server = createServer(workspace)
  await server.connect(new StdioServerTransport())
  // stderr is safe for diagnostics; stdout is the MCP channel.
  process.stderr.write(`draw-to-web MCP server ready (workspace: ${baseDir})\n`)
}

main().catch((err: unknown) => {
  process.stderr.write(`draw-to-web MCP server failed to start: ${String(err)}\n`)
  process.exit(1)
})
