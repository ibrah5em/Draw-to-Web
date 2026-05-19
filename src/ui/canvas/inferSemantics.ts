/**
 * C10 contract — semantic annotation adapter.
 *
 * Re-exports the engine's inferSemantics so Ibrahim's generator imports from
 * this path rather than directly from src/engine. Any UI-layer enrichment
 * (e.g. attaching semanticRole ARIA hints for the canvas renderer) should
 * be added here without touching the engine.
 */
export { inferSemantics, type SemanticElement, type SemanticTag } from '../../engine/index'
