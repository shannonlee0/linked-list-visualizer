import React, { useState, useEffect, useMemo } from 'react'; 
import ReactFlow, { 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState 
} from 'reactflow';
import 'reactflow/dist/style.css';

import StructNode from './components/StructNode';
import StackNode from './components/StackNode';
import NullNode from './components/NullNode';

export default function LinkedListVisualizer() {
  // --- STATE ---
  const [userCode, setUserCode] = useState(`Node* head = new Node(5);
Node* second = new Node(10);
head->next = second;
`);
  
  const [traceLog, setTraceLog] = useState([]); 
  const [step, setStep] = useState(0);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const nodeTypes = useMemo(() => ({ 
    struct: StructNode, 
    stack: StackNode,
    null: NullNode 
  }), []);

  const [showHelp, setShowHelp] = useState(false);

  // --- API CALL ---
  const handleSimulate = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5001/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: userCode }),
      });
      
      const data = await response.json();
      setTraceLog(data); 
      setStep(0); 
    } catch (error) {
      console.error("Error connecting to server:", error);
      alert("Could not connect to Python! Is server.py running on port 5001?");
    }
  };

  // --- VISUALIZATION LOGIC ---
  useEffect(() => {
    if (traceLog.length === 0) return;
    
    const currentSnapshot = traceLog[step];
    if (!currentSnapshot) return;

    const newNodes = [];
    const newEdges = [];
    
    // LANE CONTROLLER
    let globalEdgeOffset = 25; 
    let heapEdgeOffset = 15;

    // --- 1. SMART SPAWNING SYSTEM ---
    const stackPositions = {}; 
    let nextFreeX = 50; 

    // Helper: Checks if a specific X coordinate is crowded
    const isSpotTaken = (x) => {
        const collisionWidth = 160; 
        
        // 1. Check against REAL nodes currently on screen (User Dragged)
        const nodeCollision = nodes.some(n => 
            n.type === 'stack' && Math.abs(n.position.x - x) < collisionWidth
        );
        
        // 2. Check against spots we just assigned to other NEW variables in this loop
        const assignedCollision = Object.values(stackPositions).some(pos => 
            Math.abs(pos - x) < collisionWidth
        );
        
        return nodeCollision || assignedCollision;
    };

    // PASS 1: Record positions of EXISTING nodes (User Dragged)
    // We prioritize these spots first.
    Object.keys(currentSnapshot.stack).forEach(varName => {
        const nodeId = `stack-${varName}`;
        const existingNode = nodes.find(n => n.id === nodeId);
        if (existingNode) {
            stackPositions[varName] = existingNode.position.x;
        }
    });

    // PASS 2: Find safe spots for BRAND NEW nodes
    Object.keys(currentSnapshot.stack).forEach(varName => {
        // If this variable doesn't have a spot yet (it's new)...
        if (stackPositions[varName] === undefined) {
            // Keep moving right until we find a gap
            while (isSpotTaken(nextFreeX)) {
                nextFreeX += 180;
            }
            stackPositions[varName] = nextFreeX;
        }
    });

    // 0. REACHABILITY CHECK
    const reachableAddrs = new Set();
    const queue = [];
    Object.values(currentSnapshot.stack).forEach(addr => {
        if (addr) queue.push(addr);
    });
    while (queue.length > 0) {
        const currAddr = queue.shift();
        if (!reachableAddrs.has(currAddr)) {
            reachableAddrs.add(currAddr);
            const node = currentSnapshot.heap[currAddr];
            if (node && node.next) queue.push(node.next);
        }
    }

    // A. DRAW STACK
    Object.keys(currentSnapshot.stack).forEach((varName) => {
      const targetAddr = currentSnapshot.stack[varName];
      const nodeId = `stack-${varName}`;
      
      // POSITION LOGIC:
      // Use the smart position we calculated above (which respects drags AND avoids collisions)
      const stackX = stackPositions[varName];
      const stackY = 50;
      
      // Double check persistence (redundant but safe)
      const existingNode = nodes.find(n => n.id === nodeId);
      const finalPos = existingNode ? existingNode.position : { x: stackX, y: stackY };

      newNodes.push({
        id: nodeId,
        type: 'stack',
        data: { label: `${varName}` },
        position: finalPos,
      });

      // 1. ARROW
      if (targetAddr) {
        globalEdgeOffset += 15;
        newEdges.push({
          id: `edge-${varName}`,
          source: nodeId,
          target: targetAddr,
          animated: false,
          type: 'simplebezier', 
          pathOptions: { borderRadius: 50, offset: globalEdgeOffset }, 
          markerEnd: { type: 'arrowclosed', color: '#929292ff' },
          style: { stroke: '#929292ff', strokeWidth: 2, strokeDasharray: '4'},
        });
      } else {
        // Null Arrow
        const nullId = `null-stack-${varName}`;
        
        // Persist Null Node position relative to the stack box
        const existingNull = nodes.find(n => n.id === nullId);
        const nullPos = existingNull ? existingNull.position : { x: finalPos.x + 60, y: finalPos.y + 120 };

        newNodes.push({
            id: nullId,
            type: 'null', 
            position: nullPos,
        });

        globalEdgeOffset += 15;
        newEdges.push({
            id: `edge-${varName}-null`,
            source: nodeId,
            target: nullId,
            targetHandle: 'top', 
            type: 'simplebezier', 
            pathOptions: { borderRadius: 30, offset: 20 }, 
            animated: false,
            markerEnd: { type: 'arrowclosed', color: '#929292ff' }, 
            style: { stroke: '#929292ff', strokeWidth: 2, strokeDasharray: '4'},
        });
      }
    });

    // B. DRAW HEAP
    const getHeapPosition = (id, defaultX) => {
        const existing = nodes.find(n => n.id === id);
        return existing ? existing.position : { x: defaultX, y: 300 };
    };

    const sortedAddrs = Object.keys(currentSnapshot.heap).sort();
    sortedAddrs.forEach((addr, index) => {
      const nodeData = currentSnapshot.heap[addr];
      const isLeaked = !reachableAddrs.has(addr);

      newNodes.push({
        id: addr,
        type: 'struct', 
        data: { val: nodeData.val }, 
        position: getHeapPosition(addr, 50 + (index * 200)),
        style: { 
            background: '#ffffff', 
            borderColor: isLeaked ? '#ff0000' : '#cccccc',
            borderWidth: isLeaked ? '2px' : '1px',
            borderStyle: 'solid',
            boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
        }
      });

      if (nodeData.next) {
        heapEdgeOffset += 10; 
        newEdges.push({
          id: `edge-${addr}-next`,
          source: addr,
          target: nodeData.next,
          sourceHandle: 'next',
          targetHandle: 'top', 
          type: 'smoothstep',   
          pathOptions: { borderRadius: 30, offset: heapEdgeOffset },
          markerEnd: { type: 'arrowclosed', color: '#555555' }, 
          style: { stroke: '#555555', strokeWidth: 2 },
        });
      } else {
        // Point to LOCAL NULL
        const nullId = `null-heap-${addr}`;
        
        const parentPos = getHeapPosition(addr, 50 + (index * 200));
        const defaultNullPos = { x: parentPos.x + 20, y: parentPos.y + 150 };
        
        const existingNull = nodes.find(n => n.id === nullId);
        const finalNullPos = existingNull ? existingNull.position : defaultNullPos;

        newNodes.push({
            id: nullId,
            type: 'null',
            position: finalNullPos,
        });

        newEdges.push({
            id: `edge-${addr}-null`,
            source: addr,
            target: nullId,
            sourceHandle: 'next',
            targetHandle: 'top',
            type: 'simplebezier', 
            markerEnd: { type: 'arrowclosed', color: '#555555' },
            style: { stroke: '#555555', strokeWidth: 2 },
        });
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, traceLog]);

  // --- RENDER ---
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      
      {/* 1. DARK MODE OVERLAY */}
      <div style={{ 
        position: 'absolute', 
        top: '20px', 
        left: '20px', 
        zIndex: 10, 
        background: '#1e1e1e', 
        color: '#f0f0f0',       
        padding: '20px', 
        borderRadius: '10px', 
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)', 
        display: 'flex', 
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '450px',
        border: '1px solid #333'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#fff' }}>C++ Linked List Visualization</h3>
        
        <textarea 
          value={userCode}
          onChange={(e) => setUserCode(e.target.value)}
          rows={6}
          style={{ 
            padding: '10px', 
            fontFamily: 'monospace', 
            borderRadius: '5px', 
            border: '1px solid #444',
            background: '#2d2d2d', 
            color: '#e0e0e0',      
            outline: 'none'
          }}
        />
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            onClick={handleSimulate}
            style={{ 
              padding: '10px 20px', background: '#28a745', color: 'white', 
              border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' 
            }}
          >
            ▶ Simulate
          </button>
          
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} style={{background: '#444', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer'}}> 
            ⬅
          </button>
          <button onClick={() => setStep((s) => Math.min(traceLog.length - 1, s + 1))} disabled={step >= traceLog.length - 1} style={{background: '#444', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer'}}> 
            ⮕
          </button>
          
          <span style={{ fontSize: '14px', color: '#aaa' }}>
            Step: {step === 0 ? "" : step} / {traceLog.length > 0 ? traceLog.length - 1 : 0}
          </span>
        </div>

        <div style={{ fontSize: '12px', color: '#ccc', background: '#333', padding: '5px', borderRadius: '4px', border: '1px solid #444' }}>
           Code: <code style={{color: '#81d4fa'}}>{traceLog[step]?.code || ""}</code>
        </div>
      </div>

      {/* 2. BUTTER YELLOW CANVAS */}
      <ReactFlow 
        nodes={nodes} 
        edges={edges} 
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        style={{ backgroundColor: '#fff9c4' }} 
      >
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}