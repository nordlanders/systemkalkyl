import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
  MarkerType,
  Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Monitor, Server, HardDrive, Cpu, MemoryStick } from 'lucide-react';

interface CmdbServer {
  id: string;
  hostname: string;
  os: string | null;
  vcpu: number | null;
  ram_gb: number | null;
  disk_gb: number | null;
  ip_address: string | null;
  status: string | null;
  datacenter: string | null;
}

interface Props {
  systemName: string;
  servers: CmdbServer[];
}

// Custom node for the system
function SystemNode({ data }: { data: { label: string; serverCount: number } }) {
  return (
    <div className="px-6 py-4 rounded-xl border-2 border-primary bg-card shadow-lg min-w-[200px]">
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3" />
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Monitor className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="font-bold text-base">{data.label}</p>
          <p className="text-xs text-muted-foreground">{data.serverCount} servrar</p>
        </div>
      </div>
    </div>
  );
}

// Custom node for servers
function ServerNode({ data }: { data: { server: CmdbServer } }) {
  const srv = data.server;
  const isActive = srv.status === 'active';
  return (
    <div className={`px-4 py-3 rounded-lg border bg-card shadow-md min-w-[180px] ${isActive ? 'border-border' : 'border-destructive/40 opacity-70'}`}>
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !w-2 !h-2" />
      <div className="flex items-center gap-2 mb-2">
        <Server className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">{srv.hostname}</span>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        {srv.os && <p>{srv.os}</p>}
        {srv.ip_address && <p className="font-mono">{srv.ip_address}</p>}
        <div className="flex gap-3 pt-1">
          {(srv.vcpu ?? 0) > 0 && <span className="flex items-center gap-1"><Cpu className="h-3 w-3" />{srv.vcpu}</span>}
          {Number(srv.ram_gb ?? 0) > 0 && <span className="flex items-center gap-1"><MemoryStick className="h-3 w-3" />{srv.ram_gb}GB</span>}
          {Number(srv.disk_gb ?? 0) > 0 && <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" />{srv.disk_gb}GB</span>}
        </div>
      </div>
    </div>
  );
}

// Resource summary node (disk/cpu totals)
function ResourceNode({ data }: { data: { label: string; value: string; icon: string } }) {
  const Icon = data.icon === 'cpu' ? Cpu : data.icon === 'ram' ? MemoryStick : HardDrive;
  return (
    <div className="px-3 py-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 min-w-[120px]">
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground/50 !w-2 !h-2" />
      <div className="flex items-center gap-2 text-xs">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <div>
          <p className="text-muted-foreground">{data.label}</p>
          <p className="font-semibold text-foreground">{data.value}</p>
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  system: SystemNode,
  server: ServerNode,
  resource: ResourceNode,
};

export default function SystemRelationshipGraph({ systemName, servers }: Props) {
  const { nodes, edges } = useMemo(() => {
    const n: Node[] = [];
    const e: Edge[] = [];

    const serverCount = servers.length;
    const totalWidth = Math.max(serverCount * 220, 300);
    const systemX = totalWidth / 2;

    // System node at top center
    n.push({
      id: 'system',
      type: 'system',
      position: { x: systemX - 100, y: 0 },
      data: { label: systemName, serverCount },
      draggable: true,
    });

    // Server nodes in a row below
    servers.forEach((srv, i) => {
      const x = i * 220 + 10;
      n.push({
        id: `server-${srv.id}`,
        type: 'server',
        position: { x, y: 150 },
        data: { server: srv },
        draggable: true,
      });
      e.push({
        id: `e-system-${srv.id}`,
        source: 'system',
        target: `server-${srv.id}`,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
        style: { strokeWidth: 2 },
        animated: srv.status === 'active',
      });

      // Resource nodes under each server
      const resources: { id: string; label: string; value: string; icon: string }[] = [];
      if ((srv.disk_gb ?? 0) > 0) resources.push({ id: 'disk', label: 'Disk', value: `${srv.disk_gb} GB`, icon: 'disk' });

      resources.forEach((res, ri) => {
        const resId = `res-${srv.id}-${res.id}`;
        n.push({
          id: resId,
          type: 'resource',
          position: { x: x + ri * 140, y: 340 },
          data: { label: res.label, value: res.value, icon: res.icon },
          draggable: true,
        });
        e.push({
          id: `e-${srv.id}-${resId}`,
          source: `server-${srv.id}`,
          target: resId,
          type: 'smoothstep',
          style: { strokeWidth: 1, strokeDasharray: '4 4' },
        });
      });
    });

    return { nodes: n, edges: e };
  }, [systemName, servers]);

  if (servers.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        Inga servrar att visa
      </div>
    );
  }

  return (
    <div className="h-[500px] w-full rounded-lg border bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
