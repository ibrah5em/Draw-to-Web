/**
 * Canvas style-resolver context (L-CAN-02 → L-CAN-03 seam).
 *
 * The recursive {@link CanvasNode} reads its bindable-value resolver from
 * this context instead of threading a prop through every level. L-CAN-02
 * provides the {@link rawResolver}; L-CAN-03 will wrap the canvas in a
 * provider whose value is a `resolveToken`-backed resolver so token edits
 * repaint bound elements live.
 */

import { createContext, useContext } from 'react'

import { rawResolver, type StyleResolver } from './buildStyle'

const StyleResolverContext = createContext<StyleResolver>(rawResolver)

/** Provider for the active canvas style resolver. */
export const StyleResolverProvider = StyleResolverContext.Provider

/** Read the active canvas style resolver (defaults to {@link rawResolver}). */
export function useStyleResolver(): StyleResolver {
  return useContext(StyleResolverContext)
}
