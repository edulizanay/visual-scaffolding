// ABOUTME: Hardcoded theme constants for Visual Scaffolding
// ABOUTME: Single source of truth for all visual styling

export const THEME = {
  canvas: {
    background: 'linear-gradient(180deg, #0f0a1a 0%, #1a0f2e 100%)',
    fitViewPadding: 0.25,
  },
  node: {
    colors: {
      background: '#1a192b',
      border: '#2b2253',
      text: '#ffffff',
    },
    dimensions: {
      width: 172,
      height: 76,
      borderRadius: 4,
    },
    states: {
      selection: {
        colors: {
          border: 'rgba(96, 165, 250, 0.8)',
          shadow: 'rgba(96, 165, 250, 0.3)',
        },
        borderWidth: '2.4px',
        shadowSpread: '2px',
      },
      collapsedSubtree: {
        colors: {
          border: 'rgba(255, 255, 255, 0.4)',
        },
        borderWidth: '4px',
      },
    },
  },
  groupNode: {
    colors: {
      background: '#3730a3',
      border: '#6366f1',
      text: '#ffffff',
    },
    halo: {
      colors: {
        normal: 'rgba(99, 102, 241, 0.45)',
        hovered: 'rgba(129, 140, 248, 0.7)',
      },
      strokeWidth: {
        normal: 1.5,
        hovered: 2,
      },
      borderRadius: 18,
      padding: {
        x: {
          base: 18,
        },
        y: {
          base: 18,
          increment: 12,
          decay: 0.7,
          minStep: 1,
        },
      },
    },
  },
  tooltip: {
    colors: {
      background: 'rgba(30, 30, 30, 0.95)',
      border: 'rgba(96, 165, 250, 0.3)',
    },
    borderWidth: '1px',
    borderRadius: '8px',
    padding: '12px 16px',
  },
  dagre: {
    spacing: {
      horizontal: 50,
      vertical: 50,
    },
  },
};
