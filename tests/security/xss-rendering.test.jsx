// ABOUTME: Security tests verifying Node and Edge components properly escape malicious HTML/JavaScript
// ABOUTME: Tests XSS prevention by ensuring script tags, event handlers, and HTML entities are escaped on render

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import CustomNode from '../../src/Node.jsx';
import CustomEdge from '../../src/Edge.jsx';

// Mock React Flow's Handle component
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return {
    ...actual,
    Handle: ({ type, position }) => <div data-testid={`handle-${type}-${position}`} />,
    Position: actual.Position,
    BaseEdge: ({ id, path }) => <path data-testid={`base-edge-${id}`} d={path} />,
    EdgeLabelRenderer: ({ children }) => <div data-testid="edge-label-renderer">{children}</div>,
    getSmoothStepPath: () => ['M 0 0 L 100 100', 50, 50],
  };
});

describe('XSS Rendering Prevention - Node Component', () => {
  describe('Script Tag Injection', () => {
    it('should escape script tags in node labels', () => {
      const maliciousLabel = '<script>alert("xss")</script>';
      const nodeData = {
        label: maliciousLabel,
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="test-node-1" />
        </ReactFlowProvider>
      );

      // Verify the text is rendered safely (React escapes by default)
      expect(container.textContent).toContain(maliciousLabel);

      // Verify no script element is actually created
      const scriptElements = container.querySelectorAll('script');
      expect(scriptElements.length).toBe(0);

      // Verify the content is rendered as text, not HTML
      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      expect(labelDiv?.textContent).toBe(maliciousLabel);
    });

    it('should escape script tags in node descriptions', () => {
      const maliciousDescription = '<script>document.body.innerHTML=""</script>';
      const nodeData = {
        label: 'Safe Label',
        description: maliciousDescription,
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="test-node-2" />
        </ReactFlowProvider>
      );

      // Verify the script is rendered as text
      expect(container.textContent).toContain(maliciousDescription);

      // Verify no script element is created
      const scriptElements = container.querySelectorAll('script');
      expect(scriptElements.length).toBe(0);
    });
  });

  describe('Event Handler Injection', () => {
    it('should escape onclick attributes in labels', () => {
      const maliciousLabel = 'Click me" onclick="alert(1)"';
      const nodeData = {
        label: maliciousLabel,
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="test-node-3" />
        </ReactFlowProvider>
      );

      // Verify text is rendered safely
      expect(container.textContent).toContain(maliciousLabel);

      // Verify no onclick handlers were injected
      const allElements = container.querySelectorAll('*');
      allElements.forEach((element) => {
        expect(element.getAttribute('onclick')).toBeNull();
      });
    });

    it('should escape onerror attributes in descriptions', () => {
      const maliciousDescription = '" onerror="alert(\'xss\')"';
      const nodeData = {
        label: 'Test',
        description: maliciousDescription,
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="test-node-4" />
        </ReactFlowProvider>
      );

      // Verify the content is escaped
      const allElements = container.querySelectorAll('*');
      allElements.forEach((element) => {
        expect(element.getAttribute('onerror')).toBeNull();
      });
    });
  });

  describe('HTML Tag Injection', () => {
    it('should escape img tags with onerror in labels', () => {
      const maliciousLabel = '<img src=x onerror=alert(1)>';
      const nodeData = {
        label: maliciousLabel,
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="test-node-5" />
        </ReactFlowProvider>
      );

      // Verify text is displayed safely
      expect(container.textContent).toContain(maliciousLabel);

      // Verify no img element was created
      const imgElements = container.querySelectorAll('img');
      expect(imgElements.length).toBe(0);
    });

    it('should escape img tags with onerror in descriptions', () => {
      const maliciousDescription = '<img src=invalid onerror="alert(\'XSS\')">';
      const nodeData = {
        label: 'Test Node',
        description: maliciousDescription,
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="test-node-6" />
        </ReactFlowProvider>
      );

      // Verify the malicious content is rendered as text
      expect(container.textContent).toContain(maliciousDescription);

      // Verify no img elements exist
      const imgElements = container.querySelectorAll('img');
      expect(imgElements.length).toBe(0);
    });

    it('should escape iframe injection attempts', () => {
      const maliciousLabel = '<iframe src="javascript:alert(1)"></iframe>';
      const nodeData = {
        label: maliciousLabel,
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="test-node-7" />
        </ReactFlowProvider>
      );

      // Verify no iframe was created
      const iframeElements = container.querySelectorAll('iframe');
      expect(iframeElements.length).toBe(0);

      // Verify text is rendered safely
      expect(container.textContent).toContain(maliciousLabel);
    });
  });

  describe('HTML Entity Handling', () => {
    it('should properly handle HTML entities in labels', () => {
      const labelWithEntities = '&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;';
      const nodeData = {
        label: labelWithEntities,
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="test-node-8" />
        </ReactFlowProvider>
      );

      // Verify entities are rendered as-is (not decoded)
      expect(container.textContent).toContain(labelWithEntities);
    });

    it('should properly handle mixed content with entities in descriptions', () => {
      const description = 'Normal text &amp; &lt;b&gt;bold&lt;/b&gt;';
      const nodeData = {
        label: 'Test',
        description: description,
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="test-node-9" />
        </ReactFlowProvider>
      );

      // Verify entities are not decoded to HTML
      expect(container.textContent).toContain(description);
      const boldElements = container.querySelectorAll('b');
      expect(boldElements.length).toBe(0);
    });
  });

  describe('Complex XSS Vectors', () => {
    it('should escape multiple XSS attempts in single label', () => {
      const maliciousLabel = '<script>alert(1)</script><img src=x onerror=alert(2)>';
      const nodeData = {
        label: maliciousLabel,
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="test-node-10" />
        </ReactFlowProvider>
      );

      // Verify no malicious elements created
      expect(container.querySelectorAll('script').length).toBe(0);
      expect(container.querySelectorAll('img').length).toBe(0);

      // Verify text is displayed safely
      expect(container.textContent).toContain(maliciousLabel);
    });

    it('should escape SVG-based XSS attempts', () => {
      const maliciousSvg = '<svg onload=alert(1)><circle r=1></svg>';
      const nodeData = {
        label: 'Safe',
        description: maliciousSvg,
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="test-node-11" />
        </ReactFlowProvider>
      );

      // Verify SVG elements are not created (excluding React Flow's own SVG)
      const svgElements = Array.from(container.querySelectorAll('svg'));
      const hasOnloadHandler = svgElements.some(svg => svg.hasAttribute('onload'));
      expect(hasOnloadHandler).toBe(false);
    });

    it('should escape javascript: protocol URLs', () => {
      const maliciousLink = '<a href="javascript:alert(1)">Click</a>';
      const nodeData = {
        label: maliciousLink,
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="test-node-12" />
        </ReactFlowProvider>
      );

      // Verify no anchor elements with javascript: protocol
      const anchorElements = container.querySelectorAll('a[href^="javascript:"]');
      expect(anchorElements.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings safely', () => {
      const nodeData = {
        label: '',
        description: '',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="test-node-13" />
        </ReactFlowProvider>
      );

      // Should render without errors
      expect(container).toBeTruthy();
    });

    it('should handle undefined description', () => {
      const nodeData = {
        label: 'Test',
        // description intentionally undefined
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="test-node-14" />
        </ReactFlowProvider>
      );

      // Should show placeholder text
      expect(container.textContent).toContain('Add description...');
    });

    it('should handle null values', () => {
      const nodeData = {
        label: null,
        description: null,
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="test-node-15" />
        </ReactFlowProvider>
      );

      // Should render without errors
      expect(container).toBeTruthy();
    });
  });
});

describe('XSS Rendering Prevention - Edge Component', () => {
  const baseEdgeProps = {
    id: 'test-edge',
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: 'right',
    targetPosition: 'left',
  };

  describe('Script Tag Injection', () => {
    it('should escape script tags in edge labels', () => {
      const maliciousLabel = '<script>alert("xss")</script>';
      const edgeData = {
        label: maliciousLabel,
        onLabelChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseEdgeProps} data={edgeData} />
        </ReactFlowProvider>
      );

      // Verify no script element is created
      const scriptElements = container.querySelectorAll('script');
      expect(scriptElements.length).toBe(0);

      // Verify the text is rendered safely
      expect(container.textContent).toContain(maliciousLabel);
    });
  });

  describe('Event Handler Injection', () => {
    it('should escape onclick attributes in edge labels', () => {
      const maliciousLabel = '" onclick="alert(1)" data-test="';
      const edgeData = {
        label: maliciousLabel,
        onLabelChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseEdgeProps} data={edgeData} />
        </ReactFlowProvider>
      );

      // Verify no onclick handlers were injected
      const allElements = container.querySelectorAll('*');
      allElements.forEach((element) => {
        expect(element.getAttribute('onclick')).toBeNull();
      });
    });

    it('should escape onmouseover attributes', () => {
      const maliciousLabel = '" onmouseover="alert(1)"';
      const edgeData = {
        label: maliciousLabel,
        onLabelChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseEdgeProps} data={edgeData} />
        </ReactFlowProvider>
      );

      // Verify no event handlers exist
      const allElements = container.querySelectorAll('*');
      allElements.forEach((element) => {
        expect(element.getAttribute('onmouseover')).toBeNull();
      });
    });
  });

  describe('HTML Tag Injection', () => {
    it('should escape img tags with onerror', () => {
      const maliciousLabel = '<img src=x onerror=alert(1)>';
      const edgeData = {
        label: maliciousLabel,
        onLabelChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseEdgeProps} data={edgeData} />
        </ReactFlowProvider>
      );

      // Verify no img elements created
      const imgElements = container.querySelectorAll('img');
      expect(imgElements.length).toBe(0);

      // Verify text is displayed safely
      expect(container.textContent).toContain(maliciousLabel);
    });

    it('should escape iframe injection', () => {
      const maliciousLabel = '<iframe src="javascript:alert(1)"></iframe>';
      const edgeData = {
        label: maliciousLabel,
        onLabelChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseEdgeProps} data={edgeData} />
        </ReactFlowProvider>
      );

      // Verify no iframe created
      const iframeElements = container.querySelectorAll('iframe');
      expect(iframeElements.length).toBe(0);
    });
  });

  describe('HTML Entity Handling', () => {
    it('should properly handle HTML entities in edge labels', () => {
      const labelWithEntities = '&lt;script&gt; &amp; &quot;test&quot;';
      const edgeData = {
        label: labelWithEntities,
        onLabelChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseEdgeProps} data={edgeData} />
        </ReactFlowProvider>
      );

      // Verify entities are rendered as-is
      expect(container.textContent).toContain(labelWithEntities);
    });
  });

  describe('Complex XSS Vectors', () => {
    it('should escape multiple XSS attempts', () => {
      const maliciousLabel = '<script>alert(1)</script><img src=x onerror=alert(2)>';
      const edgeData = {
        label: maliciousLabel,
        onLabelChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseEdgeProps} data={edgeData} />
        </ReactFlowProvider>
      );

      // Verify no malicious elements
      expect(container.querySelectorAll('script').length).toBe(0);
      expect(container.querySelectorAll('img').length).toBe(0);
    });

    it('should escape data URI XSS attempts', () => {
      const maliciousLabel = '<img src="data:text/html,<script>alert(1)</script>">';
      const edgeData = {
        label: maliciousLabel,
        onLabelChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseEdgeProps} data={edgeData} />
        </ReactFlowProvider>
      );

      // Verify no img elements
      const imgElements = container.querySelectorAll('img');
      expect(imgElements.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty label', () => {
      const edgeData = {
        label: '',
        onLabelChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseEdgeProps} data={edgeData} />
        </ReactFlowProvider>
      );

      // Should render without errors
      expect(container).toBeTruthy();
    });

    it('should handle undefined label', () => {
      const edgeData = {
        // label intentionally undefined
        onLabelChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseEdgeProps} data={edgeData} />
        </ReactFlowProvider>
      );

      // Should render without errors
      expect(container).toBeTruthy();
    });

    it('should handle null label', () => {
      const edgeData = {
        label: null,
        onLabelChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseEdgeProps} data={edgeData} />
        </ReactFlowProvider>
      );

      // Should render without errors
      expect(container).toBeTruthy();
    });
  });
});
