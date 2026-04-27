import type { Preview } from '@storybook/react-vite'
import '../src/styles/editorial.css'

const preview: Preview = {
  tags: ['autodocs'],
  globalTypes: {
    operationalPhase: {
      description: 'Tomorrow Terminal operational phase',
      defaultValue: 'breach',
      toolbar: {
        title: 'Phase',
        icon: 'circlehollow',
        items: [
          { value: 'breach', title: 'Breach' },
          { value: 'patch', title: 'Patch' },
          { value: 'verify', title: 'Verify' },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    a11y: {
      test: 'todo'
    },

    design: {
      type: 'config',
      theme: {
        name: 'Ransom Note (Investigative Dossier)',
        colors: {
          primary: "#1c1b1b", // Charcoal Ink
          background: "#fcf9f8", // Warm Aged Paper
          accent: "#0047ab", // Cobalt Blue
          error: "#db3230", // Safety Red
          success: "#145654", // Deep Green
          surface: "#f0eded", // Surface Container
        },
        typography: {
          headline: "Epilogue, sans-serif",
          body: "Noto Serif, serif",
          label: "Space Grotesk, monospace",
        }
      }
    }
  },
};

export default preview;
