/**
 * Template: portfolio (I-TPL-02).
 *
 * Structural match of `draft/Template/index.html` — a modern dark/light
 * portfolio. The template is a pure document factory: no DOM, no React,
 * no Zustand. Sections present (top → bottom):
 *
 *   1. Fixed nav with logo + section links + theme-toggle button
 *   2. Hero: tag + h1 + subtitle + action buttons + avatar image
 *   3. About: section label + h2 + body paragraphs + interest tags + image
 *   4. Projects: label + h2 + 2-column grid of card-basic
 *   5. Stack: label + h2 + 3-column grid (cards-grid-3col)
 *   6. Connect: label + h2 + icon row with social links
 *   7. Footer: copyright text
 *
 * Wiring decisions:
 *   - The root container is a `<div>` (semanticRole `'div'`) so the
 *     emitted nav and footer sit as siblings to a real `<main>`,
 *     matching how `draft/Template/index.html` is structured. The
 *     single `<h1>` lives inside the hero.
 *   - Token registry is a superset of every existing preset's needs
 *     plus a portfolio-specific palette (text-secondary, text-dim,
 *     border, font.mono). Picking standard ids means dropping any
 *     preset onto the document still passes validation.
 *   - Runtime flags opt into every behavior the visual target uses
 *     (theme toggle, scroll-spy, smooth scroll, mobile nav,
 *     nav-on-scroll, reveals, animation gating). Snippets that have
 *     not yet shipped (I-RUN-02..08) emit nothing until they land —
 *     the flag is the contract; the document is forwards-compatible.
 *   - SEO is fully populated: title, description, OG, Twitter, JSON-LD
 *     `Person`, theme-color per scheme, preconnect for Google Fonts.
 *
 * Pixel-parity with the visual target is intentionally out of scope —
 * the goal is semantic + structural parity so the M3 demo path
 * (compose-on-canvas, swap tokens, export) lights up against a real
 * page rather than a placeholder.
 */

import { nanoid } from 'nanoid'

import type {
  ContainerNode,
  Document,
  DocumentMeta,
  DocumentSettings,
  DocumentVersion,
  ElementNode,
  IconNode,
  ImageNode,
  LinkNode,
  RuntimeFlags,
  SEOConfig,
  TextNode,
  Tokens,
} from '../document/types'

const TEMPLATE_VERSION: DocumentVersion = '0.2.0'

/**
 * Default token registry shipped with the portfolio template. Color
 * tokens carry both light and dark values; the generator emits the
 * light value in `:root` and the dark value under
 * `:root[data-theme="dark"]` (I-GEN-04). The id set is a superset of
 * every reference produced by any factory in `presetsRegistry`, so the
 * Insert sidebar can drop any preset onto this document without
 * producing dangling token refs.
 */
const PORTFOLIO_TOKENS: Tokens = {
  color: [
    { id: 'bg', name: 'Background', value: { light: '#f6f5f2', dark: '#0a0a10' } },
    {
      id: 'bg-secondary',
      name: 'Background (secondary)',
      value: { light: '#eeedea', dark: '#0f0f17' },
    },
    { id: 'surface', name: 'Surface (card)', value: { light: '#ffffff', dark: '#13131c' } },
    {
      id: 'surface-accent',
      name: 'Surface (accent tint)',
      value: { light: 'rgba(43, 108, 212, 0.06)', dark: 'rgba(77, 142, 255, 0.07)' },
    },
    {
      id: 'surface-shadow',
      name: 'Surface shadow',
      value: { light: 'rgba(0, 0, 0, 0.06)', dark: 'rgba(0, 0, 0, 0.3)' },
    },
    { id: 'text', name: 'Body text', value: { light: '#1a1a2e', dark: '#e2e2ea' } },
    {
      id: 'text-secondary',
      name: 'Text (secondary)',
      value: { light: '#5a5a6e', dark: '#8a8a9e' },
    },
    { id: 'text-dim', name: 'Text (dim)', value: { light: '#8888a0', dark: '#53536a' } },
    { id: 'accent', name: 'Accent', value: { light: '#2b6cd4', dark: '#4d8eff' } },
    { id: 'accent-soft', name: 'Accent (soft)', value: { light: '#4a88e6', dark: '#6ba1ff' } },
    { id: 'border', name: 'Border', value: { light: '#ddddd8', dark: '#1c1c2a' } },
  ],
  spacing: [
    { id: 'sm', name: 'Small', value: '8px' },
    { id: 'md', name: 'Medium', value: '16px' },
    { id: 'lg', name: 'Large', value: '32px' },
    { id: 'xl', name: 'Extra large', value: '64px' },
  ],
  fontSize: [
    { id: 'sm', name: 'Small', value: 'clamp(12px, 0.78rem, 14px)' },
    { id: 'md', name: 'Body', value: 'clamp(14px, 0.9rem + 0.2vw, 18px)' },
    { id: 'lg', name: 'Large', value: 'clamp(18px, 1rem + 0.6vw, 22px)' },
    { id: 'xl', name: 'Extra large', value: 'clamp(22px, 1.2rem + 1vw, 32px)' },
    { id: 'display', name: 'Display', value: 'clamp(44px, 2.75rem + 3.5vw, 76px)' },
  ],
  fontFamily: [
    {
      id: 'body',
      name: 'Body (sans)',
      value:
        '"Outfit", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    {
      id: 'mono',
      name: 'Mono',
      value: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    },
  ],
  lineHeight: [
    { id: 'tight', name: 'Tight', value: '1.15' },
    { id: 'normal', name: 'Normal', value: '1.6' },
    { id: 'loose', name: 'Loose', value: '1.85' },
  ],
  radius: [
    { id: 'sm', name: 'Small', value: '6px' },
    { id: 'md', name: 'Medium', value: '12px' },
    { id: 'lg', name: 'Large', value: '20px' },
  ],
  shadow: [],
}

/**
 * Opt into every runtime behavior the visual target uses. Snippets that
 * have not yet shipped (I-RUN-02..08) produce no output until they
 * land; the document is forwards-compatible.
 */
const PORTFOLIO_RUNTIME: RuntimeFlags = {
  themeToggle: true,
  scrollSpy: true,
  smoothScroll: true,
  mobileNav: true,
  navOnScroll: true,
  reveals: true,
  animationGating: true,
  terminalTyping: false,
}

const PORTFOLIO_SETTINGS: DocumentSettings = {
  contrastTarget: 'AA',
  defaultTheme: 'auto',
  gridVisible: true,
  baseUnit: 8,
  decorativeBackdrop: {
    before: {
      background: [
        {
          kind: 'linear-gradient',
          angle: '180deg',
          stops: [
            { color: 'rgba(77, 142, 255, 0.02)', position: '0%' },
            { color: 'transparent', position: '100%' },
          ],
        },
      ],
      maskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, black 20%, transparent 70%)',
    },
  },
}

/** Build a fresh element id; isolated so tests can stub it. */
const id = (): string => nanoid(8)

/** Standard text node helper for body copy. */
function text(tag: TextNode['tag'], content: string, extra: Partial<TextNode> = {}): TextNode {
  return {
    type: 'text',
    id: id(),
    tag,
    content,
    style: { base: {} },
    ...extra,
  }
}

/** Standard link node helper. */
function link(href: string, content: string, extra: Partial<LinkNode> = {}): LinkNode {
  return {
    type: 'link',
    id: id(),
    content,
    href,
    style: { base: {} },
    ...extra,
  }
}

/** Decorative icon (aria-hidden, no label needed). */
function icon(name: string): IconNode {
  return {
    type: 'icon',
    id: id(),
    name,
    decorative: true,
    style: { base: { width: '20px', height: '20px' } },
  }
}

interface SocialLink {
  readonly href: string
  readonly iconName: string
  readonly label: string
}

const SOCIAL_LINKS: ReadonlyArray<SocialLink> = [
  { href: 'https://github.com/example', iconName: 'github', label: 'GitHub' },
  { href: 'https://www.linkedin.com/in/example/', iconName: 'linkedin', label: 'LinkedIn' },
  { href: 'https://x.com/example', iconName: 'twitter', label: 'X (Twitter)' },
  { href: 'mailto:hello@example.com', iconName: 'mail', label: 'Email' },
]

const INTEREST_TAGS: ReadonlyArray<{ readonly iconName: string; readonly label: string }> = [
  { iconName: 'chess', label: 'Chess' },
  { iconName: 'star', label: 'Astronomy' },
  { iconName: 'camera', label: 'Photography' },
  { iconName: 'pen', label: 'Writing' },
  { iconName: 'palette', label: 'Design' },
  { iconName: 'joystick', label: 'Gaming' },
]

interface ProjectCard {
  readonly title: string
  readonly description: string
  readonly tags: ReadonlyArray<string>
  readonly href?: string
}

const PROJECTS: ReadonlyArray<ProjectCard> = [
  {
    title: 'x-server — deployed from scratch',
    description:
      'Production Linux server built from zero on repurposed hardware. Containerized stack (Nextcloud, Pi-hole, Portainer), Nginx + auto-renewed SSL, firewalled and monitored.',
    tags: ['Ubuntu Server', 'Docker', 'Nginx', 'Fail2ban'],
    href: 'https://example.com/x-server',
  },
  {
    title: 'pdfpeek',
    description:
      'Python package on PyPI: 10-stage PDF extraction pipeline with per-block confidence scoring, tiered install sizes, CLI + Python API.',
    tags: ['Python', 'PyPI', 'CLI', 'NLP'],
    href: 'https://github.com/example/pdfpeek',
  },
  {
    title: 'GA-Optimized Decision Trees',
    description:
      'Genetic-algorithm framework that finds the accuracy/interpretability sweet spot. Produces 46–82% smaller trees with full CI and 20-fold cross-validation.',
    tags: ['Python', 'scikit-learn', 'CI/CD', 'Research'],
    href: 'https://github.com/example/ga-trees',
  },
]

interface StackCategory {
  readonly title: string
  readonly items: ReadonlyArray<{ readonly iconName: string; readonly label: string }>
}

const STACK: ReadonlyArray<StackCategory> = [
  {
    title: 'Infrastructure',
    items: [
      { iconName: 'docker', label: 'Docker & Compose' },
      { iconName: 'server', label: 'Ubuntu Server' },
      { iconName: 'layers', label: 'Nginx' },
      { iconName: 'git-branch', label: 'CI/CD Pipelines' },
    ],
  },
  {
    title: 'Languages & Runtimes',
    items: [
      { iconName: 'python', label: 'Python' },
      { iconName: 'nodejs', label: 'Node.js' },
      { iconName: 'terminal', label: 'Bash / Zsh' },
      { iconName: 'javascript', label: 'JavaScript' },
    ],
  },
  {
    title: 'DevOps & Tooling',
    items: [
      { iconName: 'git', label: 'Git & GitHub Actions' },
      { iconName: 'shield', label: 'UFW / Fail2ban' },
      { iconName: 'filter', label: 'DNS / Pi-hole' },
      { iconName: 'linux', label: 'Linux Administration' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildNav(): ContainerNode {
  const navLinks: ContainerNode = {
    type: 'container',
    id: id(),
    name: 'Nav links',
    layout: { base: { mode: 'flex', direction: 'row', gap: 'spacing.sm', align: 'center' } },
    style: { base: { typography: { fontFamily: 'fontFamily.mono' } } },
    children: [
      link('#about', 'about'),
      link('#projects', 'projects'),
      link('#stack', 'stack'),
      link('#connect', 'connect'),
    ],
  }

  const themeToggle: ElementNode = {
    type: 'button',
    id: id(),
    content: '',
    ariaLabel: 'Toggle theme',
    attributes: { 'data-dtw-theme-toggle': '' },
    style: {
      base: {
        width: '36px',
        height: '36px',
        borderRadius: { all: 'radius.sm' },
        border: { width: '1px', style: 'solid', color: 'color.border' },
        background: [{ kind: 'solid', color: 'transparent' }],
      },
    },
  }

  return {
    type: 'container',
    id: id(),
    name: 'Site nav',
    semanticRole: 'nav',
    layout: {
      base: { mode: 'flex', direction: 'row', justify: 'space-between', align: 'center' },
    },
    style: {
      base: {
        padding: {
          top: 'spacing.md',
          right: 'spacing.lg',
          bottom: 'spacing.md',
          left: 'spacing.lg',
        },
        background: [{ kind: 'solid', color: 'color.bg' }],
        border: { width: '1px', style: 'solid', color: 'color.border' },
      },
    },
    children: [
      {
        ...link('#', '{{author}}.dev', { ariaLabel: 'Home' }),
        style: {
          base: {
            typography: {
              fontFamily: 'fontFamily.mono',
              fontSize: 'fontSize.sm',
              color: 'color.accent',
              fontWeight: 600,
            },
          },
        },
      },
      {
        type: 'container',
        id: id(),
        name: 'Nav right',
        layout: { base: { mode: 'flex', direction: 'row', gap: 'spacing.md', align: 'center' } },
        style: { base: {} },
        children: [navLinks, themeToggle],
      },
    ],
  }
}

function buildHero(): ContainerNode {
  const heroTag: TextNode = text('p', 'Systems & DevOps Engineer', {
    style: {
      base: {
        typography: {
          fontFamily: 'fontFamily.mono',
          fontSize: 'fontSize.sm',
          color: 'color.accent',
        },
      },
    },
  })

  const heroName: TextNode = text('h1', '{{author}}.', {
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
  })

  const heroSubtitle: TextNode = text(
    'p',
    'I deploy servers from scratch, set up CI/CD pipelines, and write tools that get used. Self-host my own infrastructure and automate everything I can.',
    {
      style: {
        base: {
          typography: {
            fontSize: 'fontSize.md',
            color: 'color.text-secondary',
            lineHeight: 'lineHeight.normal',
          },
          maxWidth: '480px',
        },
      },
    }
  )

  const heroActions: ContainerNode = {
    type: 'container',
    id: id(),
    name: 'Hero actions',
    layout: { base: { mode: 'flex', direction: 'row', gap: 'spacing.md', wrap: 'wrap' } },
    style: { base: {} },
    children: [
      {
        ...link('#projects', 'See my projects'),
        style: {
          base: {
            padding: {
              top: 'spacing.sm',
              right: 'spacing.lg',
              bottom: 'spacing.sm',
              left: 'spacing.lg',
            },
            borderRadius: { all: 'radius.sm' },
            background: [{ kind: 'solid', color: 'color.accent' }],
            typography: {
              fontFamily: 'fontFamily.mono',
              fontSize: 'fontSize.sm',
              color: '#ffffff',
            },
          },
        },
      },
      {
        ...link('#connect', 'Get in touch'),
        style: {
          base: {
            padding: {
              top: 'spacing.sm',
              right: 'spacing.lg',
              bottom: 'spacing.sm',
              left: 'spacing.lg',
            },
            borderRadius: { all: 'radius.sm' },
            border: { width: '1px', style: 'solid', color: 'color.border' },
            typography: {
              fontFamily: 'fontFamily.mono',
              fontSize: 'fontSize.sm',
              color: 'color.text-secondary',
            },
          },
        },
      },
    ],
  }

  const heroCopy: ContainerNode = {
    type: 'container',
    id: id(),
    name: 'Hero copy',
    layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.md', justify: 'center' } },
    style: { base: {} },
    children: [heroTag, heroName, heroSubtitle, heroActions],
  }

  const avatar: ImageNode = {
    type: 'image',
    id: id(),
    alt: '{{author}} portrait',
    externalUrl: 'https://picsum.photos/seed/portfolio-avatar/520/520',
    loading: 'eager',
    decoding: 'async',
    style: {
      base: {
        width: '260px',
        height: '260px',
        borderRadius: { all: 'radius.lg' },
        border: { width: '1px', style: 'solid', color: 'color.border' },
      },
      mobile: { width: '160px', height: '160px' },
    },
  }

  return {
    type: 'container',
    id: 'hero',
    name: 'Hero',
    semanticRole: 'section',
    layout: {
      base: { mode: 'grid', gap: 'spacing.xl', gridTemplateColumns: '1fr auto', align: 'center' },
      mobile: { mode: 'flex', direction: 'column', gap: 'spacing.lg', align: 'center' },
    },
    style: {
      base: {
        padding: {
          top: 'spacing.xl',
          right: 'spacing.lg',
          bottom: 'spacing.xl',
          left: 'spacing.lg',
        },
        maxWidth: '1100px',
      },
    },
    children: [heroCopy, avatar],
  }
}

function buildAbout(): ContainerNode {
  const sectionLabel: TextNode = text('p', '01 — About', {
    style: {
      base: {
        typography: {
          fontFamily: 'fontFamily.mono',
          fontSize: 'fontSize.sm',
          color: 'color.accent',
          letterSpacing: '0.04em',
        },
      },
    },
  })

  const heading: TextNode = text('h2', 'Building systems, not just writing code.', {
    style: {
      base: {
        typography: {
          fontSize: 'fontSize.xl',
          fontWeight: 700,
          lineHeight: 'lineHeight.tight',
          color: 'color.text',
        },
      },
    },
  })

  const paragraphStyle = {
    base: {
      typography: {
        fontSize: 'fontSize.md' as const,
        color: 'color.text-secondary' as const,
        lineHeight: 'lineHeight.loose' as const,
      },
    },
  }

  const body: ContainerNode = {
    type: 'container',
    id: id(),
    name: 'About text',
    layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.md' } },
    style: { base: {} },
    children: [
      text(
        'p',
        "I'm studying Information Technology & Management Information Systems. Most of my time goes into the stuff that sits between writing code and getting it to actually run — servers, containers, pipelines, security. The infrastructure side of things.",
        { style: paragraphStyle }
      ),
      text(
        'p',
        "I've been at it for years — started with bots and templates, and now I deploy full Linux servers from scratch, manage Docker environments, run CI/CD pipelines, and handle everything from DNS to firewalls.",
        { style: paragraphStyle }
      ),
    ],
  }

  const interests: ContainerNode = {
    type: 'container',
    id: id(),
    name: 'Interests',
    layout: { base: { mode: 'flex', direction: 'row', gap: 'spacing.sm', wrap: 'wrap' } },
    style: { base: { padding: { top: 'spacing.md' } } },
    children: INTEREST_TAGS.map(
      (i): ContainerNode => ({
        type: 'container',
        id: id(),
        name: `Tag ${i.label}`,
        layout: { base: { mode: 'flex', direction: 'row', gap: 'spacing.sm', align: 'center' } },
        style: {
          base: {
            padding: {
              top: 'spacing.sm',
              right: 'spacing.md',
              bottom: 'spacing.sm',
              left: 'spacing.md',
            },
            borderRadius: { all: 'radius.lg' },
            background: [{ kind: 'solid', color: 'color.surface-accent' }],
            typography: {
              fontFamily: 'fontFamily.mono',
              fontSize: 'fontSize.sm',
              color: 'color.accent',
            },
          },
        },
        children: [icon(i.iconName), text('span', i.label)],
      })
    ),
  }

  const copyColumn: ContainerNode = {
    type: 'container',
    id: id(),
    name: 'About copy',
    layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.md' } },
    style: { base: {} },
    children: [heading, body, interests],
  }

  const photo: ImageNode = {
    type: 'image',
    id: id(),
    alt: '{{author}} at the workstation',
    externalUrl: 'https://picsum.photos/seed/portfolio-about/800/600',
    loading: 'lazy',
    decoding: 'async',
    style: {
      base: {
        width: '100%',
        borderRadius: { all: 'radius.lg' },
        border: { width: '1px', style: 'solid', color: 'color.border' },
      },
    },
  }

  return {
    type: 'container',
    id: 'about',
    name: 'About',
    semanticRole: 'section',
    layout: {
      base: { mode: 'grid', gap: 'spacing.xl', gridTemplateColumns: '1fr 1fr', align: 'center' },
      mobile: { mode: 'flex', direction: 'column', gap: 'spacing.lg' },
    },
    style: {
      base: {
        padding: {
          top: 'spacing.xl',
          right: 'spacing.lg',
          bottom: 'spacing.xl',
          left: 'spacing.lg',
        },
        maxWidth: '1100px',
      },
    },
    children: [
      {
        type: 'container',
        id: id(),
        name: 'About header + body',
        layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.md' } },
        style: { base: {} },
        children: [sectionLabel, copyColumn],
      },
      photo,
    ],
  }
}

function buildProjectCard(project: ProjectCard): ElementNode {
  const header: TextNode = text('h3', project.title, {
    style: {
      base: {
        typography: {
          fontSize: 'fontSize.lg',
          fontWeight: 600,
          color: 'color.text',
        },
      },
    },
  })
  const description: TextNode = text('p', project.description, {
    style: {
      base: {
        typography: {
          fontSize: 'fontSize.md',
          color: 'color.text-secondary',
          lineHeight: 'lineHeight.normal',
        },
      },
    },
  })
  const tags: ContainerNode = {
    type: 'container',
    id: id(),
    name: 'Tags',
    layout: { base: { mode: 'flex', direction: 'row', gap: 'spacing.sm', wrap: 'wrap' } },
    style: { base: {} },
    children: project.tags.map(
      (t): TextNode =>
        text('span', t, {
          style: {
            base: {
              padding: {
                top: 'spacing.sm',
                right: 'spacing.sm',
                bottom: 'spacing.sm',
                left: 'spacing.sm',
              },
              borderRadius: { all: 'radius.sm' },
              background: [{ kind: 'solid', color: 'color.surface-accent' }],
              typography: {
                fontFamily: 'fontFamily.mono',
                fontSize: 'fontSize.sm',
                color: 'color.text-dim',
              },
            },
          },
        })
    ),
  }

  const children: ElementNode[] = [header, description, tags]
  if (project.href) {
    children.push({
      ...link(project.href, 'View project →', { target: '_blank' }),
      style: {
        base: {
          typography: {
            fontFamily: 'fontFamily.mono',
            fontSize: 'fontSize.sm',
            color: 'color.accent',
          },
        },
      },
    })
  }

  return {
    type: 'container',
    id: id(),
    name: project.title,
    semanticRole: 'article',
    layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.md' } },
    style: {
      base: {
        padding: {
          top: 'spacing.lg',
          right: 'spacing.lg',
          bottom: 'spacing.lg',
          left: 'spacing.lg',
        },
        borderRadius: { all: 'radius.md' },
        background: [{ kind: 'solid', color: 'color.surface' }],
        border: { width: '1px', style: 'solid', color: 'color.border' },
        shadows: [{ offsetX: '0', offsetY: '1px', blur: '3px', color: 'color.surface-shadow' }],
      },
    },
    children,
  }
}

function buildProjects(): ContainerNode {
  const sectionLabel: TextNode = text('p', '02 — Projects', {
    style: {
      base: {
        typography: {
          fontFamily: 'fontFamily.mono',
          fontSize: 'fontSize.sm',
          color: 'color.accent',
          letterSpacing: '0.04em',
        },
      },
    },
  })

  const heading: TextNode = text('h2', "Things I've built.", {
    style: {
      base: {
        typography: {
          fontSize: 'fontSize.xl',
          fontWeight: 700,
          lineHeight: 'lineHeight.tight',
          color: 'color.text',
        },
      },
    },
  })

  const description: TextNode = text(
    'p',
    'Real infrastructure, real tools — deployed and running.',
    {
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
  )

  const grid: ContainerNode = {
    type: 'container',
    id: id(),
    name: 'Projects grid',
    layout: {
      base: { mode: 'grid', gap: 'spacing.md', gridTemplateColumns: '1fr 1fr' },
      mobile: { mode: 'flex', direction: 'column', gap: 'spacing.md' },
    },
    style: { base: {} },
    children: PROJECTS.map(buildProjectCard),
  }

  return {
    type: 'container',
    id: 'projects',
    name: 'Projects',
    semanticRole: 'section',
    layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.md' } },
    style: {
      base: {
        padding: {
          top: 'spacing.xl',
          right: 'spacing.lg',
          bottom: 'spacing.xl',
          left: 'spacing.lg',
        },
        maxWidth: '1100px',
      },
    },
    children: [sectionLabel, heading, description, grid],
  }
}

function buildStack(): ContainerNode {
  const sectionLabel: TextNode = text('p', '03 — Stack', {
    style: {
      base: {
        typography: {
          fontFamily: 'fontFamily.mono',
          fontSize: 'fontSize.sm',
          color: 'color.accent',
          letterSpacing: '0.04em',
        },
      },
    },
  })

  const heading: TextNode = text('h2', 'What I work with.', {
    style: {
      base: {
        typography: {
          fontSize: 'fontSize.xl',
          fontWeight: 700,
          lineHeight: 'lineHeight.tight',
          color: 'color.text',
        },
      },
    },
  })

  const grid: ContainerNode = {
    type: 'container',
    id: id(),
    name: 'Stack grid',
    layout: {
      base: { mode: 'grid', gap: 'spacing.md', gridTemplateColumns: 'repeat(3, 1fr)' },
      mobile: { mode: 'flex', direction: 'column', gap: 'spacing.md' },
    },
    style: { base: {} },
    children: STACK.map(
      (category): ContainerNode => ({
        type: 'container',
        id: id(),
        name: category.title,
        semanticRole: 'article',
        layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.md' } },
        style: {
          base: {
            padding: {
              top: 'spacing.lg',
              right: 'spacing.lg',
              bottom: 'spacing.lg',
              left: 'spacing.lg',
            },
            borderRadius: { all: 'radius.md' },
            background: [{ kind: 'solid', color: 'color.surface' }],
            border: { width: '1px', style: 'solid', color: 'color.border' },
          },
        },
        children: [
          text('h3', category.title, {
            style: {
              base: {
                typography: {
                  fontFamily: 'fontFamily.mono',
                  fontSize: 'fontSize.sm',
                  color: 'color.accent',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                },
              },
            },
          }),
          {
            type: 'container',
            id: id(),
            name: 'Stack items',
            layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.sm' } },
            style: { base: {} },
            children: category.items.map(
              (item): ContainerNode => ({
                type: 'container',
                id: id(),
                name: item.label,
                layout: {
                  base: { mode: 'flex', direction: 'row', gap: 'spacing.sm', align: 'center' },
                },
                style: {
                  base: {
                    typography: {
                      fontSize: 'fontSize.md',
                      color: 'color.text-secondary',
                    },
                  },
                },
                children: [icon(item.iconName), text('span', item.label)],
              })
            ),
          },
        ],
      })
    ),
  }

  return {
    type: 'container',
    id: 'stack',
    name: 'Stack',
    semanticRole: 'section',
    layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.md' } },
    style: {
      base: {
        padding: {
          top: 'spacing.xl',
          right: 'spacing.lg',
          bottom: 'spacing.xl',
          left: 'spacing.lg',
        },
        maxWidth: '1100px',
      },
    },
    children: [sectionLabel, heading, grid],
  }
}

function buildConnect(): ContainerNode {
  const sectionLabel: TextNode = text('p', '04 — Connect', {
    style: {
      base: {
        typography: {
          fontFamily: 'fontFamily.mono',
          fontSize: 'fontSize.sm',
          color: 'color.accent',
          letterSpacing: '0.04em',
          textAlign: 'center',
        },
      },
    },
  })

  const heading: TextNode = text('h2', 'Say hello.', {
    style: {
      base: {
        typography: {
          fontSize: 'fontSize.xl',
          fontWeight: 700,
          textAlign: 'center',
          color: 'color.text',
        },
      },
    },
  })

  const blurb: TextNode = text('p', 'Open to work, freelance, or just a good conversation.', {
    style: {
      base: {
        typography: {
          fontSize: 'fontSize.md',
          color: 'color.text-secondary',
          textAlign: 'center',
        },
      },
    },
  })

  const linksRow: ContainerNode = {
    type: 'container',
    id: id(),
    name: 'Social links',
    layout: {
      base: { mode: 'flex', direction: 'row', gap: 'spacing.md', justify: 'center', wrap: 'wrap' },
    },
    style: { base: {} },
    children: SOCIAL_LINKS.map(
      (s): LinkNode => ({
        type: 'link',
        id: id(),
        content: '',
        href: s.href,
        ariaLabel: s.label,
        target: '_blank',
        style: {
          base: {
            width: '52px',
            height: '52px',
            borderRadius: { all: 'radius.md' },
            border: { width: '1px', style: 'solid', color: 'color.border' },
            background: [{ kind: 'solid', color: 'color.surface' }],
          },
        },
      })
    ),
  }

  return {
    type: 'container',
    id: 'connect',
    name: 'Connect',
    semanticRole: 'section',
    layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.md', align: 'center' } },
    style: {
      base: {
        padding: {
          top: 'spacing.xl',
          right: 'spacing.lg',
          bottom: 'spacing.xl',
          left: 'spacing.lg',
        },
        maxWidth: '1100px',
      },
    },
    children: [sectionLabel, heading, blurb, linksRow],
  }
}

function buildFooter(): ContainerNode {
  return {
    type: 'container',
    id: id(),
    name: 'Footer',
    semanticRole: 'footer',
    layout: { base: { mode: 'flex', direction: 'row', justify: 'center' } },
    style: {
      base: {
        padding: { top: 'spacing.lg', bottom: 'spacing.lg' },
        border: { width: '1px', style: 'solid', color: 'color.border' },
      },
    },
    children: [
      text('small', '© {{year}} {{author}} — Self-hosted. No frameworks, no templates.', {
        style: {
          base: {
            typography: {
              fontFamily: 'fontFamily.mono',
              fontSize: 'fontSize.sm',
              color: 'color.text-dim',
              textAlign: 'center',
            },
          },
        },
      }),
    ],
  }
}

function buildMain(): ContainerNode {
  return {
    type: 'container',
    id: id(),
    name: 'Page main',
    semanticRole: 'main',
    layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.xl', align: 'center' } },
    style: {
      base: {
        padding: { top: 'spacing.xl' },
        background: [{ kind: 'solid', color: 'color.bg' }],
      },
    },
    children: [buildHero(), buildAbout(), buildProjects(), buildStack(), buildConnect()],
  }
}

function buildRoot(): ContainerNode {
  return {
    type: 'container',
    id: id(),
    name: 'Page',
    semanticRole: 'div',
    layout: { base: { mode: 'flex', direction: 'column' } },
    style: {
      base: {
        background: [{ kind: 'solid', color: 'color.bg' }],
        typography: { fontFamily: 'fontFamily.body', color: 'color.text' },
      },
    },
    children: [buildNav(), buildMain(), buildFooter()],
  }
}

/**
 * Build a fresh portfolio `Document` — the M3 demo target.
 *
 * Returns a schema-valid document modelled on `draft/Template/index.html`:
 * fixed nav, hero with avatar, about, projects (2-col), stack (3-col),
 * connect (social icon row), and a footer. The root container is a
 * `<div>` so the emitted nav and footer sit as siblings to a real
 * `<main>`; the single `<h1>` lives inside the hero.
 *
 * @param authorName - Display name interpolated into `{{author}}` text and
 *   metadata (hero name, footer credit, SEO title, JSON-LD `Person`).
 *   Defaults to `'Author Name'`.
 */
export function createPortfolioTemplate(authorName: string = 'Author Name'): Document {
  const now = new Date().toISOString()
  const meta: DocumentMeta = { name: `${authorName} — Portfolio`, createdAt: now, updatedAt: now }

  const seo: SEOConfig = {
    title: `${authorName} — Systems & DevOps Engineer`,
    description:
      'Systems & DevOps engineer specializing in cloud infrastructure, CI/CD automation, container orchestration, and developer tooling.',
    keywords: ['DevOps', 'Systems Engineer', 'Infrastructure', 'Docker', 'CI/CD', 'Linux'],
    author: authorName,
    lang: 'en',
    viewport: 'width=device-width, initial-scale=1',
    charset: 'utf-8',
    canonical: 'https://example.com/',
    themeColor: { light: '#f6f5f2', dark: '#0a0a10' },
    openGraph: {
      title: `${authorName} — Systems & DevOps Engineer`,
      description: 'Infrastructure, automation, and developer tooling. Production-grade.',
      type: 'website',
      url: 'https://example.com/',
    },
    twitter: { card: 'summary_large_image' },
    jsonLd: {
      kind: 'Person',
      name: authorName,
      url: 'https://example.com/',
      jobTitle: 'Systems & DevOps Engineer',
      sameAs: [
        'https://github.com/example',
        'https://www.linkedin.com/in/example/',
        'https://x.com/example',
      ],
    },
    preconnect: ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
    robots: 'index, follow',
  }

  return {
    version: TEMPLATE_VERSION,
    meta,
    tokens: PORTFOLIO_TOKENS,
    tree: buildRoot(),
    seo,
    runtime: PORTFOLIO_RUNTIME,
    variables: {
      author: authorName,
      year: String(new Date(now).getUTCFullYear()),
    },
    settings: PORTFOLIO_SETTINGS,
    assets: {},
  }
}
