export const DEFAULT_VISUAL_SETTINGS = {
  colors: {
    background: 'linear-gradient(180deg, #0f0a1a 0%, #1a0f2e 100%)',
    allNodes: {
      background: '#1a192b',
      border: '#2b2253',
      text: '#ffffff',
    },
    perNode: {},
  },
  dimensions: {
    node: {
      default: {
        width: 172,
        height: 36,
      },
      overrides: {},
    },
    zoom: 1,
    dagre: {
      horizontal: 50,
      vertical: 50,
    },
    fitViewPadding: 0.25,
  },
};

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

export function mergeWithDefaultVisualSettings(overrides = {}) {
  const deepClone = (value) => JSON.parse(JSON.stringify(value));
  const merged = deepClone(DEFAULT_VISUAL_SETTINGS);

  const apply = (target, source) => {
    if (!isObject(source)) {
      return;
    }

    Object.entries(source).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        target[key] = [...value];
        return;
      }

      if (isObject(value)) {
        if (!isObject(target[key])) {
          target[key] = {};
        }
        apply(target[key], value);
        return;
      }

      target[key] = value;
    });
  };

  apply(merged, overrides);
  return merged;
}
