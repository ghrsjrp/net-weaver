import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { TopologyGraph } from '@/components/topology/TopologyGraph';
import { useTopologyData, useExportTopology, useSaveTopologySnapshot } from '@/hooks/useTopology';
import { TopologyNode, TopologyEdge } from '@/types/network';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Download, Save, Loader2, Network, Server, Link2 } from 'lucide-react';

export default function Topology() {
  const { data: topology, isLoading } = useTopologyData();
  const { exportDrawio, exportJSON } = useExportTopology();
  const saveSnapshot = useSaveTopologySnapshot();

  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<TopologyEdge | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDescription, setSnapshotDescription] = useState('');

  const handleExportDrawio = () => {
    if (topology) {
      const timestamp = new Date().toISOString().split('T')[0];
      exportDrawio(topology, `topology-${timestamp}.drawio`);
    }
  };

  const handleExportJSON = () => {
    if (topology) {
      const timestamp = new Date().toISOString().split('T')[0];
      exportJSON(topology, `topology-${timestamp}.json`);
    }
  };

  const handleSaveSnapshot = async () => {
    if (topology && snapshotName) {
      await saveSnapshot.mutateAsync({
        name: snapshotName,
        description: snapshotDescription,
        topology,
      });
      setIsSaveDialogOpen(false);
      setSnapshotName('');
      setSnapshotDescription('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        title="Topologia de Rede"
        description="Visualização interativa da infraestrutura"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsSaveDialogOpen(true)}
              disabled={!topology || topology.nodes.length === 0}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Salvar Snapshot
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  disabled={!topology || topology.nodes.length === 0}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportDrawio}>
                  Exportar para Draw.io (.drawio)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportJSON}>
                  Exportar JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-[calc(100vh-200px)]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : (
          <div className="h-[calc(100vh-200px)]">
            <TopologyGraph
              data={topology || { nodes: [], edges: [], metadata: { generatedAt: '', deviceCount: 0, linkCount: 0 } }}
              onNodeClick={setSelectedNode}
              onEdgeClick={setSelectedEdge}
              className="h-full"
            />
          </div>
        )}
      </div>

      {/* Node Details Sheet */}
      <Sheet open={!!selectedNode} onOpenChange={() => setSelectedNode(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              {selectedNode?.label}
            </SheetTitle>
            <SheetDescription>
              Detalhes do dispositivo
            </SheetDescription>
          </SheetHeader>
          
          {selectedNode && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm font-medium capitalize">{selectedNode.device.status}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vendor</p>
                  <p className="text-sm font-medium capitalize">{selectedNode.device.vendor}</p>
                </div>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground">Endereço IP</p>
                <p className="text-sm font-mono font-medium">{selectedNode.device.ip_address}</p>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground">Hostname</p>
                <p className="text-sm font-mono">{selectedNode.device.hostname}</p>
              </div>
              
              {selectedNode.device.model && (
                <div>
                  <p className="text-xs text-muted-foreground">Modelo</p>
                  <p className="text-sm">{selectedNode.device.model}</p>
                </div>
              )}
              
              {selectedNode.device.location && (
                <div>
                  <p className="text-xs text-muted-foreground">Localização</p>
                  <p className="text-sm">{selectedNode.device.location}</p>
                </div>
              )}
              
              {selectedNode.device.description && (
                <div>
                  <p className="text-xs text-muted-foreground">Descrição</p>
                  <p className="text-sm">{selectedNode.device.description}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Edge Details Sheet */}
      <Sheet open={!!selectedEdge} onOpenChange={() => setSelectedEdge(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Detalhes do Link
            </SheetTitle>
            <SheetDescription>
              Informações da conexão
            </SheetDescription>
          </SheetHeader>
          
          {selectedEdge && (
            <div className="mt-6 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Interface de Origem</p>
                <p className="text-sm font-mono">{selectedEdge.sourceInterface || 'N/A'}</p>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground">Interface de Destino</p>
                <p className="text-sm font-mono">{selectedEdge.targetInterface || 'N/A'}</p>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="text-sm font-medium capitalize">{selectedEdge.status}</p>
              </div>
              
              {selectedEdge.bandwidth && (
                <div>
                  <p className="text-xs text-muted-foreground">Bandwidth</p>
                  <p className="text-sm">{selectedEdge.bandwidth} Mbps</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Save Snapshot Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Snapshot</DialogTitle>
            <DialogDescription>
              Salve o estado atual da topologia para referência futura
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome</label>
              <Input
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder="Topologia Datacenter - Jan 2024"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição (opcional)</label>
              <Textarea
                value={snapshotDescription}
                onChange={(e) => setSnapshotDescription(e.target.value)}
                placeholder="Notas sobre esta versão da topologia..."
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveSnapshot}
              disabled={!snapshotName || saveSnapshot.isPending}
            >
              {saveSnapshot.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
