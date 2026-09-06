import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, GitBranch, AlertTriangle, CheckCircle } from 'lucide-react';
import { useJobContext } from '../context/JobContext';
import { STATUS } from '../constants';
import toast from 'react-hot-toast';

const prioritySizes = {
  critical: 55,
  high: 48,
  medium: 42,
  low: 36
};

const DependencyGraph = () => {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const canvasRef = useRef(null);
  const { getDependencyGraph } = useJobContext();
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const data = await getDependencyGraph();
      setGraphData(data);
    } catch (error) {
      toast.error('Failed to load dependency graph');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Layout nodes in a force-directed-ish layout
  useEffect(() => {
    if (graphData.nodes.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.offsetWidth;
    const height = canvas.height = 500;

    // Assign positions using a layered layout
    const nodePositions = {};
    const nodeMap = {};
    graphData.nodes.forEach(n => nodeMap[n.id] = n);

    // Find root nodes (no incoming edges)
    const targets = new Set(graphData.edges.map(e => e.target));
    const roots = graphData.nodes.filter(n => !targets.has(n.id));

    // BFS layering
    const layers = [];
    const visited = new Set();
    let currentLayer = roots.length > 0 ? roots : [graphData.nodes[0]];

    while (currentLayer.length > 0) {
      layers.push(currentLayer);
      currentLayer.forEach(n => visited.add(n.id));
      
      const nextLayer = [];
      currentLayer.forEach(node => {
        graphData.edges
          .filter(e => e.source === node.id)
          .forEach(e => {
            if (!visited.has(e.target) && !nextLayer.find(n => n.id === e.target)) {
              nextLayer.push(nodeMap[e.target]);
            }
          });
      });
      currentLayer = nextLayer;
    }

    // Add any unvisited nodes
    graphData.nodes.forEach(n => {
      if (!visited.has(n.id)) {
        layers.push([n]);
        visited.add(n.id);
      }
    });

    // Position nodes
    layers.forEach((layer, layerIdx) => {
      const layerWidth = width / (layer.length + 1);
      layer.forEach((node, nodeIdx) => {
        nodePositions[node.id] = {
          x: layerWidth * (nodeIdx + 1),
          y: 60 + layerIdx * (height - 120) / Math.max(layers.length - 1, 1),
          ...node
        };
      });
    });

    // Animation
    let animFrame;
    let time = 0;

    const draw = () => {
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      // Draw edges
      graphData.edges.forEach(edge => {
        const source = nodePositions[edge.source];
        const target = nodePositions[edge.target];
        if (!source || !target) return;

        ctx.beginPath();
        ctx.strokeStyle = edge.status === 'failed' ? STATUS.failed.color :
                         edge.status === 'satisfied' ? STATUS.success.color : '#475569';
        ctx.lineWidth = edge.status === 'failed' ? 3 : 2;
        ctx.setLineDash(edge.status === 'failed' ? [8, 4] : []);

        // Curved line
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2 - 20;
        
        ctx.moveTo(source.x, source.y);
        ctx.quadraticCurveTo(midX, midY, target.x, target.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrow
        const angle = Math.atan2(target.y - midY, target.x - midX);
        const arrowLen = 10;
        ctx.beginPath();
        ctx.moveTo(target.x, target.y);
        ctx.lineTo(
          target.x - arrowLen * Math.cos(angle - Math.PI / 6),
          target.y - arrowLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(target.x, target.y);
        ctx.lineTo(
          target.x - arrowLen * Math.cos(angle + Math.PI / 6),
          target.y - arrowLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      });

      // Draw nodes
      Object.values(nodePositions).forEach(node => {
        const radius = prioritySizes[node.priority] / 2;
        const isSelected = selectedNode?.id === node.id;
        const pulse = isSelected ? Math.sin(time * 3) * 3 : 0;

        // Glow for selected
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 8 + pulse, 0, Math.PI * 2);
          ctx.fillStyle = `${STATUS[node.status].color}33`;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = STATUS[node.status].color;
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.stroke();

        // Status dot
        ctx.beginPath();
        ctx.arc(node.x + radius * 0.7, node.y - radius * 0.7, 5, 0, Math.PI * 2);
        ctx.fillStyle = STATUS[node.status].color;
        ctx.fill();

        // Node text
        ctx.fillStyle = '#0f172a';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        
        const words = node.name.split(' ');
        const lines = [];
        let line = '';
        words.forEach(word => {
          if ((line + ' ' + word).length > 14) {
            lines.push(line);
            line = word;
          } else {
            line = line ? line + ' ' + word : word;
          }
        });
        if (line) lines.push(line);

        lines.forEach((l, i) => {
          ctx.fillText(l, node.x, node.y + radius + 14 + i * 14);
        });

        // Priority label
        ctx.fillStyle = STATUS[node.status].color;
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.fillText(node.priority.toUpperCase(), node.x, node.y + 3);
      });

      animFrame = requestAnimationFrame(draw);
    };

    draw();

    // Click handler
    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      for (const node of Object.values(nodePositions)) {
        const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
        if (dist < prioritySizes[node.priority] / 2 + 5) {
          setSelectedNode(node);
          return;
        }
      }
      setSelectedNode(null);
    };

    canvas.addEventListener('click', handleClick);

    return () => {
      cancelAnimationFrame(animFrame);
      canvas.removeEventListener('click', handleClick);
    };
  }, [graphData, selectedNode]);

  if (loading) {
    return (
      <div className="page-loading">
        <RefreshCw size={32} className="spin" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Dependency Graph</h1>
          <p className="subtitle">Visualize job dependencies and failure cascades</p>
        </div>
        <button className="btn-refresh" onClick={fetchData}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Legend */}
      <div className="graph-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: STATUS.active.color }} />
          <span>{STATUS.active.label}</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: STATUS.failed.color }} />
          <span>{STATUS.failed.label}</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: STATUS.paused.color }} />
          <span>{STATUS.paused.label}</span>
        </div>
        <div className="legend-separator" />
        <div className="legend-item">
          <span className="legend-line solid" />
          <span>Satisfied</span>
        </div>
        <div className="legend-item">
          <span className="legend-line dashed" />
          <span>Failed Dep</span>
        </div>
      </div>

      {/* Graph Canvas */}
      <div className="graph-container">
        <canvas ref={canvasRef} className="graph-canvas" />
      </div>

      {/* Selected Node Info */}
      {selectedNode && (
        <div className="node-info-panel">
          <div className="node-info-header">
            <h3>{selectedNode.name}</h3>
            <span className={`status-badge ${selectedNode.status}`}>{selectedNode.status}</span>
          </div>
          <div className="node-info-details">
            <span>Category: {selectedNode.category}</span>
            <span>Priority: {selectedNode.priority}</span>
            {selectedNode.consecutiveFailures > 0 && (
              <span className="text-red">
                <AlertTriangle size={14} /> {selectedNode.consecutiveFailures} consecutive failures
              </span>
            )}
          </div>
          <button 
            className="btn-primary"
            onClick={() => navigate(`/jobs/${selectedNode.id}`)}
          >
            View Job Details
          </button>
        </div>
      )}

      {/* Stats Summary */}
      <div className="dep-stats">
        <div className="dep-stat">
          <span className="dep-stat-num">{graphData.nodes.length}</span>
          <span className="dep-stat-label">Total Jobs</span>
        </div>
        <div className="dep-stat">
          <span className="dep-stat-num">{graphData.edges.length}</span>
          <span className="dep-stat-label">Dependencies</span>
        </div>
        <div className="dep-stat">
          <span className="dep-stat-num text-red">
            {graphData.edges.filter(e => e.status === 'failed').length}
          </span>
          <span className="dep-stat-label">Broken Links</span>
        </div>
        <div className="dep-stat">
          <span className="dep-stat-num text-green">
            {graphData.nodes.filter(n => n.status === 'active').length}
          </span>
          <span className="dep-stat-label">Healthy</span>
        </div>
      </div>
    </div>
  );
};

export default DependencyGraph;
