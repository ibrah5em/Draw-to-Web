/**
 * Template: resume (I-TPL-04).
 *
 * Single-page résumé designed to print cleanly to one A4 sheet. Relies
 * on the print stylesheet emitted by I-GEN-13: `@page` margin 12 mm,
 * single-column flow, decorative pseudos hidden, `a[href]::after`
 * appending the URL after links so they survive on paper, and
 * `break-inside: avoid` on headings and articles.
 *
 * Structure (top → bottom):
 *
 *   1. Header  — name (h1) + tagline + contact strip (email, location, github)
 *   2. Summary — h2 + one-paragraph profile
 *   3. Experience — h2 + N article entries (h3 role-at-company, date span,
 *                   responsibilities list)
 *   4. Education  — h2 + N article entries
 *   5. Skills     — h2 + flex-wrap pill grid
 *
 * The root is a `<main>` so print rules don't hide it (the I-GEN-13
 * sheet hides `<nav>` and `<footer>`). Runtime is intentionally JS-lean:
 * only `themeToggle` opts in; everything else stays off so the printed
 * page is identical to the screen render.
 */

import { nanoid } from 'nanoid'

import type {
  ContainerNode,
  Document,
  DocumentMeta,
  DocumentSettings,
  DocumentVersion,
  ElementNode,
  LinkNode,
  ListNode,
  RuntimeFlags,
  SEOConfig,
  TextNode,
  Tokens,
} from '../document/types'

const TEMPLATE_VERSION: DocumentVersion = '0.2.0'

/**
 * Token registry tuned for print: high-contrast text colors that read
 * the same on screen and on paper, neutral surfaces, no shadows.
 */
const RESUME_TOKENS: Tokens = {
  color: [
    { id: 'bg', name: 'Background', value: { light: '#ffffff', dark: '#0d0d12' } },
    { id: 'surface', name: 'Surface', value: { light: '#ffffff', dark: '#14141c' } },
    {
      id: 'surface-accent',
      name: 'Surface (accent tint)',
      value: { light: '#eef2ff', dark: '#1a2238' },
    },
    {
      id: 'surface-shadow',
      name: 'Surface shadow',
      value: { light: 'rgba(0, 0, 0, 0.06)', dark: 'rgba(0, 0, 0, 0.4)' },
    },
    { id: 'text', name: 'Body text', value: { light: '#0f172a', dark: '#f1f5f9' } },
    {
      id: 'text-secondary',
      name: 'Text (secondary)',
      value: { light: '#334155', dark: '#a8b1c7' },
    },
    { id: 'text-dim', name: 'Text (dim)', value: { light: '#475569', dark: '#7e8aa3' } },
    { id: 'accent', name: 'Accent', value: { light: '#1e40af', dark: '#7aa2ff' } },
    { id: 'border', name: 'Border', value: { light: '#cbd5e1', dark: '#1f2536' } },
  ],
  spacing: [
    { id: 'xs', name: 'Extra small', value: '4px' },
    { id: 'sm', name: 'Small', value: '8px' },
    { id: 'md', name: 'Medium', value: '16px' },
    { id: 'lg', name: 'Large', value: '24px' },
    { id: 'xl', name: 'Extra large', value: '40px' },
  ],
  fontSize: [
    { id: 'xs', name: 'Tiny', value: '11px' },
    { id: 'sm', name: 'Small', value: '12.5px' },
    { id: 'md', name: 'Body', value: '14px' },
    { id: 'lg', name: 'Large', value: '17px' },
    { id: 'xl', name: 'Extra large', value: '22px' },
    { id: 'display', name: 'Display', value: '32px' },
  ],
  fontFamily: [
    {
      id: 'body',
      name: 'Body (sans)',
      value:
        '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
  ],
  lineHeight: [
    { id: 'tight', name: 'Tight', value: '1.2' },
    { id: 'normal', name: 'Normal', value: '1.45' },
  ],
  radius: [
    { id: 'sm', name: 'Small', value: '4px' },
    { id: 'md', name: 'Medium', value: '8px' },
  ],
  shadow: [],
}

const RESUME_RUNTIME: RuntimeFlags = {
  themeToggle: true,
  scrollSpy: false,
  smoothScroll: false,
  mobileNav: false,
  navOnScroll: false,
  reveals: false,
  animationGating: false,
  terminalTyping: false,
}

const RESUME_SETTINGS: DocumentSettings = {
  contrastTarget: 'AA',
  defaultTheme: 'light',
  gridVisible: true,
  baseUnit: 8,
}

const id = (): string => nanoid(8)

interface ExperienceEntry {
  readonly role: string
  readonly company: string
  readonly dates: string
  readonly bullets: ReadonlyArray<string>
}

interface EducationEntry {
  readonly degree: string
  readonly institution: string
  readonly dates: string
}

const SUMMARY =
  'Systems engineer with eight years of experience designing, building, and operating production infrastructure. Comfortable owning a stack end-to-end — from kernel-level tuning through to the CI/CD pipeline that ships changes.'

const EXPERIENCE: ReadonlyArray<ExperienceEntry> = [
  {
    role: 'Senior Infrastructure Engineer',
    company: 'Northbound Systems',
    dates: '2022 — Present',
    bullets: [
      'Led the migration of the core service mesh from Kubernetes manifests to Helm + Argo CD, cutting deploy lead-time from 45 min to 6 min.',
      'Designed the on-call rotation and incident playbook adopted by three sister teams; reduced mean time-to-acknowledge from 18 min to under 4.',
      'Authored the internal Terraform module library now used across 40+ services.',
    ],
  },
  {
    role: 'Platform Engineer',
    company: 'Greypath Labs',
    dates: '2019 — 2022',
    bullets: [
      'Built an auto-scaling Postgres replica pool that absorbed a 12× traffic spike during the public beta.',
      'Owned the observability stack (Prometheus + Grafana + Loki); created dashboards and SLOs adopted org-wide.',
    ],
  },
  {
    role: 'DevOps Engineer',
    company: 'Tessellate',
    dates: '2017 — 2019',
    bullets: [
      'Containerised a legacy PHP monolith and shipped its first blue/green deploy pipeline.',
      'Introduced Nix-based dev environments; reduced new-hire on-boarding from three days to half a day.',
    ],
  },
]

const EDUCATION: ReadonlyArray<EducationEntry> = [
  {
    degree: 'B.Sc. Computer Science',
    institution: 'University of Example',
    dates: '2013 — 2017',
  },
]

const SKILLS: ReadonlyArray<string> = [
  'Kubernetes',
  'Terraform',
  'Argo CD',
  'AWS',
  'GCP',
  'Postgres',
  'Prometheus',
  'Grafana',
  'Python',
  'Go',
  'Bash',
  'Linux administration',
  'Incident response',
]

/** Section heading style — repeated across summary/experience/education/skills. */
const SECTION_H2_STYLE = {
  base: {
    typography: {
      fontSize: 'fontSize.lg' as const,
      fontWeight: 700 as const,
      color: 'color.text' as const,
      letterSpacing: '0.04em' as const,
      textTransform: 'uppercase' as const,
    },
    border: {
      width: '0 0 1px 0',
      style: 'solid' as const,
      color: 'color.border' as const,
    },
    padding: { bottom: 'spacing.xs' as const },
  },
}

/** Container that groups a section heading with its body. */
function buildSection(
  staticId: string,
  heading: string,
  body: ReadonlyArray<ElementNode>
): ContainerNode {
  return {
    type: 'container',
    id: staticId,
    name: heading,
    semanticRole: 'section',
    layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.md' } },
    style: { base: {} },
    children: [
      {
        type: 'text',
        id: id(),
        tag: 'h2',
        content: heading,
        style: SECTION_H2_STYLE,
      },
      ...body,
    ],
  }
}

function buildHeader(name: string): ContainerNode {
  const heading: TextNode = {
    type: 'text',
    id: id(),
    tag: 'h1',
    content: name,
    style: {
      base: {
        typography: {
          fontSize: 'fontSize.display',
          fontWeight: 700,
          lineHeight: 'lineHeight.tight',
          color: 'color.text',
        },
      },
    },
  }
  const tagline: TextNode = {
    type: 'text',
    id: id(),
    tag: 'p',
    content: 'Senior Infrastructure Engineer · Self-hosted, automated, observable.',
    style: {
      base: {
        typography: {
          fontSize: 'fontSize.md',
          color: 'color.text-secondary',
        },
      },
    },
  }
  const contactRow: ContainerNode = {
    type: 'container',
    id: id(),
    name: 'Contact strip',
    layout: { base: { mode: 'flex', direction: 'row', gap: 'spacing.md', wrap: 'wrap' } },
    style: { base: {} },
    children: [
      { ...mkContact('mailto:hello@example.com', 'hello@example.com') },
      { ...mkContact('https://github.com/example', 'github.com/example', true) },
      { ...mkText('Berlin, DE') },
    ],
  }
  return {
    type: 'container',
    id: id(),
    name: 'Resume header',
    semanticRole: 'header',
    layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.sm' } },
    style: {
      base: {
        padding: { bottom: 'spacing.md' },
        border: { width: '0 0 1px 0', style: 'solid', color: 'color.border' },
      },
    },
    children: [heading, tagline, contactRow],
  }
}

function mkContact(href: string, label: string, external: boolean = false): LinkNode {
  return {
    type: 'link',
    id: id(),
    content: label,
    href,
    target: external ? '_blank' : undefined,
    style: {
      base: {
        typography: {
          fontSize: 'fontSize.sm',
          color: 'color.accent',
        },
      },
    },
  }
}

function mkText(content: string): TextNode {
  return {
    type: 'text',
    id: id(),
    tag: 'span',
    content,
    style: {
      base: {
        typography: {
          fontSize: 'fontSize.sm',
          color: 'color.text-dim',
        },
      },
    },
  }
}

function buildExperienceEntry(entry: ExperienceEntry): ContainerNode {
  const header: ContainerNode = {
    type: 'container',
    id: id(),
    name: 'Entry header',
    layout: {
      base: { mode: 'flex', direction: 'row', justify: 'space-between', wrap: 'wrap' },
    },
    style: { base: {} },
    children: [
      {
        type: 'text',
        id: id(),
        tag: 'h3',
        content: `${entry.role} · ${entry.company}`,
        style: {
          base: {
            typography: {
              fontSize: 'fontSize.md',
              fontWeight: 600,
              color: 'color.text',
            },
          },
        },
      },
      {
        type: 'text',
        id: id(),
        tag: 'span',
        content: entry.dates,
        style: {
          base: {
            typography: {
              fontSize: 'fontSize.sm',
              color: 'color.text-dim',
            },
          },
        },
      },
    ],
  }
  const bullets: ListNode = {
    type: 'list',
    id: id(),
    ordered: false,
    items: [...entry.bullets],
    style: {
      base: {
        typography: {
          fontSize: 'fontSize.sm',
          color: 'color.text-secondary',
          lineHeight: 'lineHeight.normal',
        },
        padding: { left: 'spacing.md' },
      },
    },
  }
  return {
    type: 'container',
    id: id(),
    name: `${entry.role} @ ${entry.company}`,
    semanticRole: 'article',
    layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.xs' } },
    style: { base: {} },
    children: [header, bullets],
  }
}

function buildEducationEntry(entry: EducationEntry): ContainerNode {
  return {
    type: 'container',
    id: id(),
    name: `${entry.degree} @ ${entry.institution}`,
    semanticRole: 'article',
    layout: {
      base: { mode: 'flex', direction: 'row', justify: 'space-between', wrap: 'wrap' },
    },
    style: { base: {} },
    children: [
      {
        type: 'text',
        id: id(),
        tag: 'h3',
        content: `${entry.degree} · ${entry.institution}`,
        style: {
          base: {
            typography: {
              fontSize: 'fontSize.md',
              fontWeight: 600,
              color: 'color.text',
            },
          },
        },
      },
      {
        type: 'text',
        id: id(),
        tag: 'span',
        content: entry.dates,
        style: {
          base: {
            typography: {
              fontSize: 'fontSize.sm',
              color: 'color.text-dim',
            },
          },
        },
      },
    ],
  }
}

function buildSkills(): ContainerNode {
  return {
    type: 'container',
    id: id(),
    name: 'Skill pills',
    layout: { base: { mode: 'flex', direction: 'row', gap: 'spacing.sm', wrap: 'wrap' } },
    style: { base: {} },
    children: SKILLS.map(
      (skill): TextNode => ({
        type: 'text',
        id: id(),
        tag: 'span',
        content: skill,
        style: {
          base: {
            padding: {
              top: 'spacing.xs',
              right: 'spacing.sm',
              bottom: 'spacing.xs',
              left: 'spacing.sm',
            },
            borderRadius: { all: 'radius.sm' },
            background: [{ kind: 'solid', color: 'color.surface-accent' }],
            border: { width: '1px', style: 'solid', color: 'color.border' },
            typography: {
              fontSize: 'fontSize.sm',
              color: 'color.text-secondary',
            },
          },
        },
      })
    ),
  }
}

function buildRoot(authorName: string): ContainerNode {
  const summaryBody: TextNode = {
    type: 'text',
    id: id(),
    tag: 'p',
    content: SUMMARY,
    style: {
      base: {
        typography: {
          fontSize: 'fontSize.md',
          color: 'color.text-secondary',
          lineHeight: 'lineHeight.normal',
        },
      },
    },
  }

  return {
    type: 'container',
    id: id(),
    name: 'Resume',
    semanticRole: 'main',
    layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.lg' } },
    style: {
      base: {
        background: [{ kind: 'solid', color: 'color.bg' }],
        typography: { fontFamily: 'fontFamily.body', color: 'color.text' },
        padding: {
          top: 'spacing.xl',
          right: 'spacing.xl',
          bottom: 'spacing.xl',
          left: 'spacing.xl',
        },
        maxWidth: '880px',
      },
    },
    children: [
      buildHeader(authorName),
      buildSection('summary', 'Summary', [summaryBody]),
      buildSection('experience', 'Experience', EXPERIENCE.map(buildExperienceEntry)),
      buildSection('education', 'Education', EDUCATION.map(buildEducationEntry)),
      buildSection('skills', 'Skills', [buildSkills()]),
    ],
  }
}

/**
 * Build a fresh résumé `Document` that prints to a single A4 page.
 *
 * Returns a schema-valid document with header → summary → experience →
 * education → skills, rooted on `<main>` so the I-GEN-13 print
 * stylesheet keeps it visible. IDs come from `nanoid` so successive
 * calls do not collide.
 *
 * @param authorName - Person whose résumé this is. Used as the page
 *   `<h1>`, the SEO title, and the JSON-LD `Person`. Defaults to
 *   `'Author Name'`.
 */
export function createResumeTemplate(authorName: string = 'Author Name'): Document {
  const now = new Date().toISOString()
  const meta: DocumentMeta = { name: `${authorName} — Résumé`, createdAt: now, updatedAt: now }

  const seo: SEOConfig = {
    title: `${authorName} — Résumé`,
    description: `Single-page résumé for ${authorName}. Experience, education, and skills.`,
    keywords: ['resume', 'cv', authorName],
    author: authorName,
    lang: 'en',
    viewport: 'width=device-width, initial-scale=1',
    charset: 'utf-8',
    canonical: 'https://example.com/resume',
    themeColor: { light: '#ffffff', dark: '#0d0d12' },
    openGraph: {
      title: `${authorName} — Résumé`,
      description: `Single-page résumé for ${authorName}.`,
      type: 'website',
      url: 'https://example.com/resume',
    },
    twitter: { card: 'summary_large_image' },
    jsonLd: {
      kind: 'Person',
      name: authorName,
      url: 'https://example.com/',
    },
    robots: 'index, follow',
  }

  return {
    version: TEMPLATE_VERSION,
    meta,
    tokens: RESUME_TOKENS,
    tree: buildRoot(authorName),
    seo,
    runtime: RESUME_RUNTIME,
    variables: {
      author: authorName,
      year: String(new Date(now).getUTCFullYear()),
    },
    settings: RESUME_SETTINGS,
    assets: {},
  }
}
