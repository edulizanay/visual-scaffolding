// ABOUTME: Custom edge component with inline editable labels
// ABOUTME: Allows double-click editing of edge labels directly on the canvas
import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';

import { THEME } from '../../../constants/theme.js';
import { useInlineEdit } from '../../../shared/hooks/useInlineEdit.js';

const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}) => {
  const labelEdit = useInlineEdit(data?.label || '', data?.onLabelChange, id, data?.label);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          onDoubleClick={labelEdit.handleDoubleClick}
        >
          {labelEdit.isEditing ? (
            <input
              className="nodrag nopan"
              value={labelEdit.editValue}
              onChange={labelEdit.handleChange}
              onBlur={labelEdit.handleBlur}
              onKeyDown={labelEdit.handleKeyDown}
              autoFocus
              style={{
                background: THEME.colors.deepPurple,
                border: '1px solid #555',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '3px',
                fontSize: '12px',
                fontFamily: 'inherit',
              }}
            />
          ) : (
            <div
              style={{
                background: data?.label ? THEME.colors.deepPurple : 'transparent',
                opacity: data?.label ? 1 : 0,
                padding: '2px 8px',
                borderRadius: '3px',
                fontSize: '12px',
                color: 'white',
                cursor: 'text',
              }}
            >
              {data?.label || '\u00A0'}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default memo(CustomEdge);
