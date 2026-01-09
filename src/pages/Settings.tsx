import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { getVendorDisplayInfo } from '@/lib/vendors/registry';
import { toast } from 'sonner';
import { Loader2, Settings2, Clock, Database, Shield, Check } from 'lucide-react';

interface SystemSetting {
  key: string;
  value: string;
  description?: string;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const vendors = getVendorDisplayInfo();
  
  const { data: settings, isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*');
      
      if (error) throw error;
      
      return (data || []).reduce((acc, s) => {
        acc[s.key] = { 
          value: typeof s.value === 'string' ? s.value : JSON.stringify(s.value), 
          description: s.description 
        };
        return acc;
      }, {} as Record<string, { value: string; description?: string | null }>);
    },
  });

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from('system_settings')
        .update({ value: value })
        .eq('key', key);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      toast.success('Configuração salva');
    },
    onError: (error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});

  const handleSettingChange = (key: string, value: string) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = (key: string) => {
    const value = localSettings[key] ?? settings?.[key]?.value;
    if (value !== undefined) {
      updateSetting.mutate({ key, value });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header title="Configurações" description="Ajuste as configurações do sistema" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        title="Configurações"
        description="Ajuste as configurações do sistema de descoberta"
      />

      <div className="p-6 max-w-4xl space-y-6">
        {/* Coleta */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle>Coleta de Dados</CardTitle>
            </div>
            <CardDescription>
              Configure os parâmetros de coleta de topologia
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="collection_interval">Intervalo de Coleta (segundos)</Label>
                <div className="flex gap-2">
                  <Input
                    id="collection_interval"
                    type="number"
                    value={localSettings.collection_interval ?? settings?.collection_interval?.value ?? '300'}
                    onChange={(e) => handleSettingChange('collection_interval', e.target.value)}
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleSave('collection_interval')}
                    disabled={updateSetting.isPending}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Intervalo entre coletas automáticas
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ssh_timeout">Timeout SSH (segundos)</Label>
                <div className="flex gap-2">
                  <Input
                    id="ssh_timeout"
                    type="number"
                    value={localSettings.ssh_timeout ?? settings?.ssh_timeout?.value ?? '30'}
                    onChange={(e) => handleSettingChange('ssh_timeout', e.target.value)}
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleSave('ssh_timeout')}
                    disabled={updateSetting.isPending}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tempo máximo de espera por conexão
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="max_concurrent">Coletas Simultâneas</Label>
                <div className="flex gap-2">
                  <Input
                    id="max_concurrent"
                    type="number"
                    value={localSettings.max_concurrent_collections ?? settings?.max_concurrent_collections?.value ?? '5'}
                    onChange={(e) => handleSettingChange('max_concurrent_collections', e.target.value)}
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleSave('max_concurrent_collections')}
                    disabled={updateSetting.isPending}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Número máximo de coletas em paralelo
                </p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div className="space-y-0.5">
                  <Label>Descoberta Automática</Label>
                  <p className="text-xs text-muted-foreground">
                    Cadastrar novos dispositivos descobertos
                  </p>
                </div>
                <Switch
                  checked={settings?.auto_discovery_enabled?.value === 'true'}
                  onCheckedChange={(checked) => {
                    updateSetting.mutate({ 
                      key: 'auto_discovery_enabled', 
                      value: checked.toString() 
                    });
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vendors */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle>Vendors Suportados</CardTitle>
            </div>
            <CardDescription>
              Status de implementação dos módulos de vendor
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {vendors.map((vendor) => (
                <div
                  key={vendor.name}
                  className={`p-4 rounded-lg border ${
                    vendor.supported 
                      ? 'border-primary/30 bg-primary/5' 
                      : 'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{vendor.displayName}</span>
                    {vendor.supported ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                        Ativo
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        Em breve
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sistema */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <CardTitle>Sistema</CardTitle>
            </div>
            <CardDescription>
              Informações e ações do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
              <div>
                <p className="font-medium text-foreground">Versão do Sistema</p>
                <p className="text-sm text-muted-foreground">NetTopo v1.0.0</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
              <div>
                <p className="font-medium text-foreground">Arquitetura</p>
                <p className="text-sm text-muted-foreground">Vendor-Agnostic Modular Design</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
