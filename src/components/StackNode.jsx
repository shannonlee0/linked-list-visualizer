import React from 'react';
import { Handle, Position } from 'reactflow';

const StackNode = ({ data }) => {
  
  // HELPER: Formats "confuse_list" into "list" with subscript "confuse"
  const renderLabel = (text) => {
    // 1. Check if it's a scoped variable (has an underscore)
    if (text.includes('_')) {
      const parts = text.split('_');
      const funcName = parts[0];       // e.g. "confuse"
      const varName = parts.slice(1).join('_'); // e.g. "list"

      return (
        <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
          {varName}
          <sub style={{ 
            fontSize: '0.7em', 
            color: '#666', 
            marginLeft: '2px', 
            fontWeight: 'normal' 
          }}>
            {funcName}
          </sub>
        </span>
      );
    }
    // 2. If it's just "head" or "list", return as is
    return text;
  };

  return (
    <div style={{
      background: '#ffffffff', 
      color: '#000000ff',      
      padding: '10px 15px', 
      borderRadius: '3px',
      fontWeight: 'bold',
      
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
      border: '1px solid #b7b7b7ff', 
      fontFamily: 'monospace',
      
      // Flexbox ensures the text and subscript align nicely
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      
      {/* RENDER THE FANCY LABEL */}
      {renderLabel(data.label)}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, border: 'none' }}
      />
    </div>
  );
};

export default StackNode;