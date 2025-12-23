import React from 'react';
import { Handle, Position } from 'reactflow';

const StructNode = ({ data }) => {
  return (
    <div style={{ 
      minWidth: '80px',
      fontFamily: 'monospace',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      
      {/* Top Section: Value */}
      <div style={{ 
        color: '#000000',      // Black Text
        padding: '10px', 
        textAlign: 'center', 
        borderBottom: '1px solid #cccccc', 
        position: 'relative'
      }}>
        {/* INVISIBLE TARGET HANDLE (Top) */}
        <Handle 
          type="target" 
          position={Position.Top} 
          style={{ opacity: 0, border: 'none' }} 
        />
        <strong>{data.val}</strong>
      </div>

      {/* Bottom Section: Pointer */}
      <div style={{ 
        padding: '5px', 
        textAlign: 'center', 
        fontSize: '12px',
        flex: 1, 
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <span style={{ color: '#888' }}>next</span>
        
        {/* INVISIBLE SOURCE HANDLE (Bottom) */}
        <Handle 
          type="source" 
          position={Position.Bottom} 
          id="next"
          style={{ opacity: 0, border: 'none', bottom: 0 }} 
        />
      </div>
    </div>
  );
};

export default StructNode;