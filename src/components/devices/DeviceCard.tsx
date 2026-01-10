import { NetworkDevice } from '@/types/network';
import { cn } from '@/lib/utils';
import { Server, MapPin, Clock, MoreVertical, Trash2, Edit, Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DeviceCardProps {
  device: NetworkDevice;
  onEdit?: (device: NetworkDevice) => void;
  onDelete?: (device: NetworkDevice) => void;
  onCollect?: (device: NetworkDevice) => void;
  isCollecting?: boolean;
}

const statusStyles = {
  online: 'status-dot-online',
  offline: 'status-dot-offline',
  unknown: 'status-dot-unknown',
  error: 'status-dot-error',
};

const vendorColors: Record<string, string> = {
  huawei: 'border-l-red-500',
  juniper: 'border-l-green-500',
  mikrotik: 'border-l-blue-500',
  datacom: 'border-l-orange-500',
  cisco: 'border-l-sky-500',
  other: 'border-l-gray-500',
};

export function DeviceCard({ device, onEdit, onDelete, onCollect, isCollecting }: DeviceCardProps) {
  return (
    <div
      className={cn(
        'group rounded-xl border border-border bg-card p-5 transition-all duration-200',
        'hover:shadow-lg hover:border-primary/30 border-l-4',
        vendorColors[device.vendor] || vendorColors.other,
        isCollecting && 'ring-2 ring-primary/50 animate-pulse'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted relative">
            {isCollecting ? (
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            ) : (
              <Server className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{device.name}</h3>
              <div className={cn('status-dot', statusStyles[device.status])} />
              {isCollecting && (
                <span className="text-xs text-primary font-medium">Coletando...</span>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground font-mono-data">
              {device.ip_address}
            </p>
            
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="capitalize">{device.vendor}</span>
              {device.model && <span>• {device.model}</span>}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              disabled={isCollecting}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onCollect?.(device)} disabled={isCollecting}>
              {isCollecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {isCollecting ? 'Coletando...' : 'Coletar Dados'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit?.(device)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete?.(device)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          <span>{device.location || 'Sem localização'}</span>
        </div>
        
        {device.last_seen && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              {formatDistanceToNow(new Date(device.last_seen), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
