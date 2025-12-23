import React from 'react';
import { Handle, Position } from 'reactflow';

const NullNode = () => {
  return (
    <div style={{
      width: '40px',
      height: '24px',
      background: '#555555', // Dark Grey
      color: '#ffffff',      // White text
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '10px',
      fontWeight: 'bold',
      fontFamily: 'monospace',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      border: '1px solid #555555'
    }}>
      {/* 1. LEFT HANDLE: For Stack Variables pointing to NULL */}
      <Handle 
        type="target" 
        position={Position.Left} 
        id="left"
        style={{ opacity: 0, border: 'none' }}
      />

      {/* 2. TOP HANDLE: For Heap Nodes pointing to NULL */}
      <Handle 
        type="target" 
        position={Position.Top} 
        id="top"
        style={{ opacity: 0, border: 'none' }}
      />
      
      NULL
    </div>
  );
};

export default NullNode;