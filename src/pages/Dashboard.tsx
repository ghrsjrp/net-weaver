import { Header } from '@/components/layout/Header';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { VendorBreakdown } from '@/components/dashboard/VendorBreakdown';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { TopologyGraph } from '@/components/topology/TopologyGraph';
import { useDeviceStats } from '@/hooks/useDevices';
import { VendorType } from '@/types/network';
import { useTopologyData } from '@/hooks/useTopology';
import { Server, Wifi, WifiOff, Link2, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const stats = useDeviceStats();
  const { data: topology, isLoading: topologyLoading } = useTopologyData();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <Header
        title="Dashboard"
        description="Visão geral da sua infraestrutura de rede"
        actions={
          <Button onClick={() => navigate('/devices')} className="gap-2">
            <Server className="h-4 w-4" />
            Adicionar Dispositivo
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total de Dispositivos"
            value={stats.total}
            subtitle="Cadastrados no sistema"
            icon={Server}
          />
          <StatsCard
            title="Online"
            value={stats.online}
            subtitle="Respondendo"
            icon={Wifi}
            variant="success"
          />
          <StatsCard
            title="Offline"
            value={stats.offline}
            subtitle="Sem resposta"
            icon={WifiOff}
            variant="danger"
          />
          <StatsCard
            title="Links Descobertos"
            value={topology?.edges.length || 0}
            subtitle="Conexões mapeadas"
            icon={Link2}
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Topologia Preview */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Network className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold text-foreground">Topologia da Rede</h2>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/topology')}>
                  Ver Completo
                </Button>
              </div>
              <div className="h-[400px]">
                {topologyLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : topology ? (
                  <TopologyGraph data={topology} />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Nenhum dado de topologia
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <VendorBreakdown data={stats.byVendor as Record<VendorType, number>} />
            <RecentActivity />
          </div>
        </div>
      </div>
    </div>
  );
}
