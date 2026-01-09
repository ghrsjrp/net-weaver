import { useRef, useEffect, useState, useCallback } from 'react';
import { TopologyData, TopologyNode, TopologyEdge } from '@/types/network';
import { cn } from '@/lib/utils';

interface TopologyGraphProps {
  data: TopologyData;
  onNodeClick?: (node: TopologyNode) => void;
  onEdgeClick?: (edge: TopologyEdge) => void;
  className?: string;
}

export function TopologyGraph({ data, onNodeClick, onEdgeClick, className }: TopologyGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  }, [transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }));
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({
      ...prev,
      scale: Math.min(Math.max(prev.scale * delta, 0.5), 2),
    }));
  }, []);

  // Mapear nós por ID para lookup rápido
  const nodeMap = new Map(data.nodes.map(n => [n.id, n]));

  if (data.nodes.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-full bg-muted/20 rounded-xl border border-dashed border-border', className)}>
        <div className="text-center p-8">
          <div className="text-4xl mb-4">🌐</div>
          <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma topologia</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Cadastre dispositivos e execute coletas para visualizar a topologia da rede
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-border bg-card noc-grid', className)}>
      {/* Controles */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 2) }))}
          className="w-8 h-8 rounded-lg bg-card border border-border text-foreground hover:bg-accent flex items-center justify-center"
        >
          +
        </button>
        <button
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(prev.scale * 0.8, 0.5) }))}
          className="w-8 h-8 rounded-lg bg-card border border-border text-foreground hover:bg-accent flex items-center justify-center"
        >
          −
        </button>
        <button
          onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
          className="w-8 h-8 rounded-lg bg-card border border-border text-foreground hover:bg-accent flex items-center justify-center text-xs"
        >
          ⟲
        </button>
      </div>

      {/* Info do nó hover */}
      {hoveredNode && (
        <div className="absolute top-4 left-4 z-10 p-3 rounded-lg bg-popover border border-border shadow-lg max-w-xs">
          {(() => {
            const node = nodeMap.get(hoveredNode);
            if (!node) return null;
            return (
              <>
                <p className="font-medium text-foreground">{node.label}</p>
                <p className="text-xs text-muted-foreground font-mono">{node.device.ip_address}</p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">{node.device.vendor} • {node.device.status}</p>
              </>
            );
          })()}
        </div>
      )}

      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        style={{ minHeight: '500px' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Edges */}
          {data.edges.map((edge) => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);
            if (!source || !target) return null;

            const isHovered = hoveredEdge === edge.id;
            const isActive = edge.status === 'up';

            return (
              <g key={edge.id}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={isActive ? 'hsl(var(--link-active))' : 'hsl(var(--link-inactive))'}
                  strokeWidth={isHovered ? 4 : 2}
                  strokeOpacity={isHovered ? 1 : 0.7}
                  className="topo-link cursor-pointer"
                  onMouseEnter={() => setHoveredEdge(edge.id)}
                  onMouseLeave={() => setHoveredEdge(null)}
                  onClick={() => onEdgeClick?.(edge)}
                />
                {/* Label da interface */}
                {edge.sourceInterface && (
                  <text
                    x={(source.x! + target.x!) / 2}
                    y={(source.y! + target.y!) / 2 - 10}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[10px] pointer-events-none"
                  >
                    {edge.sourceInterface} ↔ {edge.targetInterface}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {data.nodes.map((node) => {
            const isHovered = hoveredNode === node.id;
            const size = node.size || 30;

            return (
              <g
                key={node.id}
                className="topo-node"
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => onNodeClick?.(node)}
              >
                {/* Glow effect quando hover */}
                {isHovered && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={size + 10}
                    fill={node.color}
                    opacity={0.2}
                    className="animate-pulse"
                  />
                )}
                
                {/* Círculo principal */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={size / 2}
                  fill={node.color}
                  stroke={isHovered ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                  strokeWidth={isHovered ? 3 : 2}
                />
                
                {/* Ícone do dispositivo */}
                <text
                  x={node.x}
                  y={node.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-white text-xs font-bold pointer-events-none"
                >
                  {node.device.vendor === 'huawei' ? 'H' : node.device.vendor.charAt(0).toUpperCase()}
                </text>
                
                {/* Label */}
                <text
                  x={node.x}
                  y={(node.y || 0) + size / 2 + 15}
                  textAnchor="middle"
                  className="fill-foreground text-xs font-medium pointer-events-none"
                >
                  {node.label}
                </text>

                {/* Status indicator */}
                <circle
                  cx={(node.x || 0) + size / 2 - 5}
                  cy={(node.y || 0) - size / 2 + 5}
                  r={5}
                  fill={
                    node.device.status === 'online' ? 'hsl(var(--status-online))' :
                    node.device.status === 'offline' ? 'hsl(var(--status-offline))' :
                    'hsl(var(--status-unknown))'
                  }
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                />
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legenda */}
      <div className="absolute bottom-4 left-4 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-status-online" />
          <span>Online</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-status-offline" />
          <span>Offline</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-status-unknown" />
          <span>Desconhecido</span>
        </div>
      </div>
    </div>
  );
}
