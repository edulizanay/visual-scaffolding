// ABOUTME: Custom node component with label and italic description
// ABOUTME: Displays node data with styling for visual hierarchy
import { memo, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';

const CustomNode = ({ data, id }) => {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabelValue, setEditLabelValue] = useState(data.label);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescriptionValue, setEditDescriptionValue] = useState(data.description || '');
  const textColor = data.textColor || 'white';

  const handleLabelDoubleClick = useCallback(() => {
    setIsEditingLabel(true);
  }, []);

  const handleLabelChange = useCallback((evt) => {
    setEditLabelValue(evt.target.value);
  }, []);

  const handleLabelBlur = useCallback(() => {
    setIsEditingLabel(false);
    if (data.onLabelChange && editLabelValue !== data.label) {
      data.onLabelChange(id, editLabelValue);
    }
  }, [data, id, editLabelValue]);

  const handleLabelKeyDown = useCallback((evt) => {
    if (evt.key === 'Enter') {
      evt.target.blur();
    }
  }, []);

  const handleDescriptionDoubleClick = useCallback(() => {
    setIsEditingDescription(true);
  }, []);

  const handleDescriptionChange = useCallback((evt) => {
    setEditDescriptionValue(evt.target.value);
  }, []);

  const handleDescriptionBlur = useCallback(() => {
    setIsEditingDescription(false);
    if (data.onDescriptionChange) {
      data.onDescriptionChange(id, editDescriptionValue);
    }
  }, [data, id, editDescriptionValue]);

  const handleDescriptionKeyDown = useCallback((evt) => {
    if (evt.key === 'Enter') {
      evt.target.blur();
    }
  }, []);

  const descriptionText = data.description || 'Add description...';
  const isPlaceholder = !data.description;

  return (
    <>
      <Handle type="target" position={Position.Left} />
      {isEditingLabel ? (
        <input
          className="nodrag"
          value={editLabelValue}
          onChange={handleLabelChange}
          onBlur={handleLabelBlur}
          onKeyDown={handleLabelKeyDown}
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
        <div onDoubleClick={handleLabelDoubleClick} style={{ cursor: 'text' }}>
          {data.label}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
      {isEditingDescription ? (
        <input
          className="nodrag"
          value={editDescriptionValue}
          onChange={handleDescriptionChange}
          onBlur={handleDescriptionBlur}
          onKeyDown={handleDescriptionKeyDown}
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
          onDoubleClick={handleDescriptionDoubleClick}
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
