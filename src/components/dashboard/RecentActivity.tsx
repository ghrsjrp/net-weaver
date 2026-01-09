import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CollectionStatus } from '@/types/network';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';

interface CollectionRecord {
  id: string;
  device_id: string;
  collection_type: string;
  status: CollectionStatus;
  started_at: string;
  completed_at?: string;
  error_message?: string;
}

function mapRecord(data: Record<string, unknown>): CollectionRecord {
  return {
    id: data.id as string,
    device_id: data.device_id as string,
    collection_type: data.collection_type as string,
    status: data.status as CollectionStatus,
    started_at: data.started_at as string,
    completed_at: data.completed_at as string | undefined,
    error_message: data.error_message as string | undefined,
  };
}

const statusConfig: Record<CollectionStatus, { icon: typeof Clock; color: string; label: string; animate?: boolean }> = {
  pending: { icon: Clock, color: 'text-muted-foreground', label: 'Pendente' },
  running: { icon: Loader2, color: 'text-info', label: 'Executando', animate: true },
  completed: { icon: CheckCircle2, color: 'text-status-online', label: 'Concluído' },
  failed: { icon: XCircle, color: 'text-status-offline', label: 'Falhou' },
};

export function RecentActivity() {
  const { data: collections, isLoading } = useQuery({
    queryKey: ['recent-collections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collection_history')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return (data || []).map(d => mapRecord(d as Record<string, unknown>));
    },
  });

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          Atividade Recente
        </h3>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : collections && collections.length > 0 ? (
        <div className="space-y-4">
          {collections.map((collection) => {
            const config = statusConfig[collection.status];
            const Icon = config.icon;
            return (
              <div
                key={collection.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
              >
                <Icon
                  className={cn(
                    'h-5 w-5 mt-0.5',
                    config.color,
                    config.animate && 'animate-spin'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Coleta {collection.collection_type.toUpperCase()}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {config.label}
                    {collection.error_message && `: ${collection.error_message}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(collection.started_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Nenhuma atividade recente
          </p>
        </div>
      )}
    </div>
  );
}
