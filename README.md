# null-hype.github.io

Plain Astro site for the `null-hype.github.io` Pages deployment.

## Commands

All commands are run from the project root:

| Command | Action |
| :--- | :--- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the local Astro dev server |
| `npm run build` | Build the production site into `dist/` |
| `npm run preview` | Preview the production build locally |

## Structure

The site now follows a normal Astro layout:

```
.
├── public/
├── src/
│   ├── layouts/
│   └── pages/
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

`astro.config.mjs` keeps the `SITE` and `BASE_PATH` environment variables so the existing GitHub Pages workflow can build correctly for project or user pages.
