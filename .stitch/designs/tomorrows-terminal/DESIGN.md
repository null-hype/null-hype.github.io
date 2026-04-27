# Tomorrow's Terminal: The Purple Team Design System

## 1. Overview: Theme-as-Mode
This design system is built to switch seamlessly between offensive and defensive cybersecurity perspectives using the standard Light/Dark mode toggle.

- **Red Team (Dark Mode):** The "Hacker's Void." Deep black backgrounds with neon crimson accents. The environment feels aggressive, high-stakes, and clandestine.
- **Blue Team (Light Mode):** The "Forensic Dashboard." Clean, surgical off-white backgrounds with cyan and deep blue accents. The environment feels authoritative, transparent, and structured.

## 2. Color Logic
- **Primary (#ff2e4c):** Neon Crimson (Red Team).
- **Secondary (#00f0ff):** Cyan (Blue Team).
- **Background (Dark):** #0d1117 (Deep Void Black).
- **Background (Light):** #fcf9f2 (Forensic White).

## 3. Typography
- **Headlines (Space Grotesk):** Geometric and technical.
- **Body (Inter):** Clean and functional for documentation.
- **Code (Space Mono / Google Sans Mono):** Used for the terminal stream and the Peek View sandbox.

## 4. Components
- **Code Lenses:** Pill-shaped interactive buttons that change glow intensity based on the active mode.
- **Peek View:** Inline expansions with 1px solid borders. The border color follows the mode (Red for Exploitation, Blue for Patching).
- **Diagnostics:** Neon squigglies that indicate "Alignment Drift" or "Security Vulnerabilities."
