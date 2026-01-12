import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDevices } from '@/hooks/useDevices';
import { useCollectAllDevices, useCollectDevice } from '@/hooks/useCollection';
import { CollectionStatus } from '@/types/network';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Clock, Loader2, Play, History } from 'lucide-react';

interface CollectionRecord {
  id: string;
  device_id: string;
  collection_type: string;
  status: CollectionStatus;
  started_at: string;
  completed_at?: string;
  error_message?: string;
  device_name?: string;
}

const statusConfig: Record<CollectionStatus, { icon: typeof CheckCircle2; variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  pending: { icon: Clock, variant: 'secondary', label: 'Pendente' },
  running: { icon: Loader2, variant: 'default', label: 'Executando' },
  completed: { icon: CheckCircle2, variant: 'outline', label: 'Concluído' },
  failed: { icon: XCircle, variant: 'destructive', label: 'Falhou' },
};

export default function Collections() {
  const { data: devices } = useDevices();
  const collectDevice = useCollectDevice();
  const collectAllDevices = useCollectAllDevices();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('all');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['lldp', 'ospf', 'interfaces', 'system']);

  const { data: collections, isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const { data: collectionsData, error: collectionsError } = await supabase
        .from('collection_history')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(100);
      
      if (collectionsError) throw collectionsError;
      
      const deviceIds = [...new Set((collectionsData || []).map(c => c.device_id))];
      const { data: devicesData } = await supabase
        .from('network_devices')
        .select('id, name')
        .in('id', deviceIds);
      
      const deviceMap = new Map((devicesData || []).map(d => [d.id, d.name]));
      
      return (collectionsData || []).map(c => ({
        ...c,
        device_name: deviceMap.get(c.device_id) || 'Dispositivo removido',
      })) as CollectionRecord[];
    },
  });

  const handleStartCollection = async () => {
    if (selectedDeviceId === 'all') {
      if (devices && devices.length > 0) {
        await collectAllDevices.mutateAsync(devices.map(d => d.id));
      }
    } else {
      await collectDevice.mutateAsync({ 
        deviceId: selectedDeviceId,
        collectionTypes: selectedTypes,
      });
    }
    setIsDialogOpen(false);
  };

  const toggleCollectionType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const isCollecting = collectDevice.isPending || collectAllDevices.isPending;

  return (
    <div className="min-h-screen">
      <Header
        title="Histórico de Coletas"
        description="Acompanhe as execuções de descoberta de topologia"
        actions={
          <Button 
            className="gap-2" 
            onClick={() => setIsDialogOpen(true)}
            disabled={!devices || devices.length === 0}
          >
            <Play className="h-4 w-4" />
            Nova Coleta
          </Button>
        }
      />

      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : collections && collections.length > 0 ? (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Iniciado</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((collection) => {
                  const config = statusConfig[collection.status];
                  const Icon = config.icon;
                  const duration = collection.completed_at
                    ? Math.round(
                        (new Date(collection.completed_at).getTime() -
                          new Date(collection.started_at).getTime()) /
                          1000
                      )
                    : null;

                  return (
                    <TableRow key={collection.id}>
                      <TableCell className="font-medium">
                        {collection.device_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="uppercase text-xs">
                          {collection.collection_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={config.variant} className="gap-1">
                          <Icon className={cn(
                            'h-3 w-3',
                            collection.status === 'running' && 'animate-spin'
                          )} />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(collection.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {duration !== null ? `${duration}s` : '-'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {collection.error_message || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
              <History className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhuma coleta registrada
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Execute coletas nos dispositivos para descobrir a topologia da rede
            </p>
            <Button 
              className="gap-2" 
              onClick={() => setIsDialogOpen(true)}
              disabled={!devices || devices.length === 0}
            >
              <Play className="h-4 w-4" />
              Iniciar Coleta
            </Button>
          </div>
        )}
      </div>

      {/* Dialog para Nova Coleta */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Coleta</DialogTitle>
            <DialogDescription>
              Selecione o dispositivo e os tipos de coleta a executar
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Dispositivo</Label>
              <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um dispositivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os dispositivos</SelectItem>
                  {devices?.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name} ({device.ip_address})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipos de Coleta</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'lldp', label: 'LLDP Neighbors' },
                  { id: 'ospf', label: 'OSPF Neighbors' },
                  { id: 'interfaces', label: 'Interfaces' },
                  { id: 'system', label: 'System Info' },
                ].map((type) => (
                  <div key={type.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={type.id}
                      checked={selectedTypes.includes(type.id)}
                      onCheckedChange={() => toggleCollectionType(type.id)}
                    />
                    <Label htmlFor={type.id} className="text-sm font-normal cursor-pointer">
                      {type.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleStartCollection} 
              disabled={isCollecting || selectedTypes.length === 0}
            >
              {isCollecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedDeviceId === 'all' ? 'Coletar Todos' : 'Iniciar Coleta'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
