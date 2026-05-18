# Element Model

The canonical data structure that all layers operate on. Defined in `src/store/elementStore.ts`.

## CanvasElement

```ts
interface CanvasElement {
  id: string // UUID, stable across sessions
  type: 'rectangle' | 'text' | 'image' | 'button'
  x: number // Grid column index (0–11)
  y: number // Pixel Y from canvas top
  width: number // Grid column span (1–12)
  height: number // Pixel height
  props: {
    text?: string // text/button label
    src?: string // image URL or data URI
    alt?: string // image alt text (required for a11y gate)
    fontSize?: number // text: px
    fontFamily?: string
    color?: string // CSS color
    background?: string // CSS color
    borderRadius?: number // px
  }
}
```

## Type → HTML Mapping

| type      | HTML tag   | Condition                          |
| --------- | ---------- | ---------------------------------- |
| rectangle | `<header>` | y < 80 and width ≥ 10              |
| rectangle | `<footer>` | bottom of canvas and width ≥ 10    |
| rectangle | `<main>`   | largest central element            |
| rectangle | `<nav>`    | children are a horizontal link row |
| rectangle | `<div>`    | default                            |
| text      | `<h1>`     | fontSize ≥ 36                      |
| text      | `<h2>`     | fontSize ≥ 24                      |
| text      | `<h3>`     | fontSize ≥ 18                      |
| text      | `<p>`      | fontSize < 18                      |
| image     | `<img>`    | always; `alt` required             |
| button    | `<button>` | always                             |

## Grid System

`x` and `width` are in 12-column grid units. The generator maps these to CSS Grid `grid-column` declarations. `y` and `height` are in pixels, emitted as `margin-top` or `min-height`.
