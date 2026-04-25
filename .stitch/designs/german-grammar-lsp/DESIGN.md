# Design System Strategy: Grammar as Protocol

## 1. Overview & Creative North Star
**The Creative North Star: "The Semantic IDE"**

This design system treats natural language grammar with the same rigor and affordance as source code. It rejects the "word processor" aesthetic in favor of a **warm, crafted development environment**. The goal is to make grammar feel like a protocol—a structured set of rules that can be hovered, peeked, and automatically refactored.

The aesthetic is inspired by high-end, dark-theme editors like **Zed** and **VS Code (Night Owl/Tokyo Night variant)**, but with a more tactile, "editorial" warmth. We avoid the high-contrast "neon-on-black" look of traditional hacker themes, opting instead for a palette of deep charcoals, warm grays, and a single subtle accent for rule references.

---

## 2. Colors & Surface Logic

The palette is built on "Atmospheric Depth."

- **Background (#18181a):** A deep, warm charcoal. The primary workspace surface.
- **Surface Low (#1e1e20):** Used for the sidebar and status bar.
- **Surface High (#252529):** Used for tooltips, peek panels, and hover states.
- **Accents:**
    - **Selection (#333338):** Subtle highlight.
    - **Error (#f44747):** Used for squiggles and diagnostics.
    - **Rule Accent (#9cdcfe):** A soft blue for rule names and references.
    - **Fix Icon (#ffcc00):** A warm amber for the lightbulb action.

---

## 3. Typography: Syntax and UI

- **Editor Pane (Monospace):** Use a clean, legible monospace font like **JetBrains Mono** or **Fira Code**. This reinforces the "grammar as code" metaphor.
- **UI Panels (Sans-Serif):** Use a humanist sans-serif like **Inter** for tooltips, peek panels, and the sidebar. The contrast between the rigid monospace code and the readable sans-serif documentation provides clarity.

---

## 4. Components & Interactions

### The Editor Surface
- **Tabs:** Sharp 0px corners. The active tab (`sentence.de`) has a subtle top-border in the rule accent color.
- **Squiggles:** Red wavy underlines for grammatical diagnostics.
- **Minimap:** A high-level view on the right showing a single red marker for the error position.

### LSP Affordances
- **Hover Tooltip:** A floating panel with high transparency (glassmorphism) and backdrop-blur. It should clearly separate "Inferred State" from "Required State."
- **Peek Panel:** An inline expansion that shifts the code lines down, revealing a structured, Pkl-like rule definition.
- **Status Bar:** Fixed at the bottom, showing the connection status of the "German Grammar Server."

---

## 5. Interaction States (Mockup Sequence)

1.  **Baseline**: Clean editor, text only.
2.  **Diagnostic**: Error detection with squiggle and problems panel.
3.  **Hover**: Tooltip revealing semantic metadata.
4.  **Peek**: Inline rule documentation.
5.  **Quick Fix**: Lightbulb menu and automated correction.

---

## 6. Do’s and Don’ts

### Do:
- **Use "Warmth":** Soften the dark theme with slight brown/blue undertones.
- **Structure Data:** Format grammar rules like Pkl or JSON to emphasize the "protocol" aspect.
- **Maintain Precision:** Use exact pixel alignments for the editor UI (line numbers, cursor, status bar).

### Don’t:
- **No Rounded Corners (mostly):** Keep the IDE feel architectural and sharp.
- **No Gradients:** Use flat colors and transparency (blur) for depth.
- **No Animations:** Transitions between states should be instant or very fast "snaps" to mimic the high-performance feel of a modern editor.
