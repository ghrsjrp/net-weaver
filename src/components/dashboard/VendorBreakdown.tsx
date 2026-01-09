import { VendorType } from '@/types/network';
import { cn } from '@/lib/utils';

interface VendorBreakdownProps {
  data: Record<VendorType, number>;
}

const vendorConfig: Record<VendorType, { label: string; color: string }> = {
  huawei: { label: 'Huawei', color: 'bg-red-500' },
  juniper: { label: 'Juniper', color: 'bg-green-500' },
  mikrotik: { label: 'MikroTik', color: 'bg-blue-500' },
  datacom: { label: 'Datacom', color: 'bg-orange-500' },
  cisco: { label: 'Cisco', color: 'bg-sky-500' },
  other: { label: 'Outros', color: 'bg-gray-500' },
};

export function VendorBreakdown({ data }: VendorBreakdownProps) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  
  const vendors = Object.entries(data)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (vendors.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          Dispositivos por Vendor
        </h3>
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum dispositivo cadastrado
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">
        Dispositivos por Vendor
      </h3>
      
      {/* Barra de progresso empilhada */}
      <div className="h-3 rounded-full overflow-hidden flex mb-4">
        {vendors.map(([vendor, count]) => {
          const percentage = (count / total) * 100;
          const config = vendorConfig[vendor as VendorType];
          return (
            <div
              key={vendor}
              className={cn('h-full', config.color)}
              style={{ width: `${percentage}%` }}
            />
          );
        })}
      </div>

      {/* Lista de vendors */}
      <div className="space-y-2">
        {vendors.map(([vendor, count]) => {
          const config = vendorConfig[vendor as VendorType];
          const percentage = ((count / total) * 100).toFixed(1);
          return (
            <div key={vendor} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('h-3 w-3 rounded-full', config.color)} />
                <span className="text-sm text-foreground">{config.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{count}</span>
                <span className="text-xs text-muted-foreground">({percentage}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
