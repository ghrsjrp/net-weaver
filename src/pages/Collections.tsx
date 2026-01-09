import { Header } from '@/components/layout/Header';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CollectionStatus } from '@/types/network';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
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
  const { data: collections, isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const { data: collectionsData, error: collectionsError } = await supabase
        .from('collection_history')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(100);
      
      if (collectionsError) throw collectionsError;
      
      // Buscar nomes dos dispositivos
      const deviceIds = [...new Set((collectionsData || []).map(c => c.device_id))];
      const { data: devices } = await supabase
        .from('network_devices')
        .select('id, name')
        .in('id', deviceIds);
      
      const deviceMap = new Map((devices || []).map(d => [d.id, d.name]));
      
      return (collectionsData || []).map(c => ({
        ...c,
        device_name: deviceMap.get(c.device_id) || 'Dispositivo removido',
      })) as CollectionRecord[];
    },
  });

  return (
    <div className="min-h-screen">
      <Header
        title="Histórico de Coletas"
        description="Acompanhe as execuções de descoberta de topologia"
        actions={
          <Button className="gap-2">
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
            <Button className="gap-2">
              <Play className="h-4 w-4" />
              Iniciar Coleta
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
