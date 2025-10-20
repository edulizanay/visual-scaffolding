// ABOUTME: Custom node component with label and italic description
// ABOUTME: Displays node data with styling for visual hierarchy
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useInlineEdit } from './shared/hooks/useInlineEdit.js';

const CustomNode = ({ data, id }) => {
  const textColor = data.textColor || 'white';

  const labelEdit = useInlineEdit(data.label, data.onLabelChange, id, data.label);
  const descriptionEdit = useInlineEdit(
    data.description || '',
    data.onDescriptionChange,
    id,
    data.description,
    true  // alwaysSave: true for description
  );

  const descriptionText = data.description || 'Add description...';
  const isPlaceholder = !data.description;

  return (
    <>
      <Handle type="target" position={Position.Left} />
      {labelEdit.isEditing ? (
        <input
          className="nodrag"
          value={labelEdit.editValue}
          onChange={labelEdit.handleChange}
          onBlur={labelEdit.handleBlur}
          onKeyDown={labelEdit.handleKeyDown}
          autoFocus
          style={{
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            padding: 0,
            width: '100%',
            textAlign: 'center',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            outline: '1px solid #555',
          }}
        />
      ) : (
        <div onDoubleClick={labelEdit.handleDoubleClick} style={{ cursor: 'text' }}>
          {data.label}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
      {descriptionEdit.isEditing ? (
        <input
          className="nodrag"
          value={descriptionEdit.editValue}
          onChange={descriptionEdit.handleChange}
          onBlur={descriptionEdit.handleBlur}
          onKeyDown={descriptionEdit.handleKeyDown}
          autoFocus
          style={{
            background: 'transparent',
            border: 'none',
            color: textColor,
            padding: 0,
            width: '100%',
            textAlign: 'center',
            fontFamily: 'inherit',
            fontSize: '11px',
            fontStyle: 'italic',
            outline: '1px solid #555',
            marginTop: '4px',
          }}
        />
      ) : (
        <div
          onDoubleClick={descriptionEdit.handleDoubleClick}
          style={{
            fontSize: '11px',
            fontStyle: 'italic',
            opacity: isPlaceholder ? 0.4 : 0.6,
            marginTop: '4px',
            cursor: 'text',
            color: textColor,
          }}
        >
          {descriptionText}
        </div>
      )}
    </>
  );
};

export default memo(CustomNode);
