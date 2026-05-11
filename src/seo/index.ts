export interface SEOConfig {
  title: string
  description: string
  ogImage?: string
  canonicalUrl?: string
}

/**
 * Post-processes generated HTML to inject SEO meta tags, ARIA attributes,
 * and validates heading structure. Zero violations required for export.
 * @param html - Raw HTML from the code generator
 * @param config - SEO metadata provided by the user
 */
export function injectSEO(_html: string, _config: SEOConfig): string {
  throw new Error('Not implemented')
}
