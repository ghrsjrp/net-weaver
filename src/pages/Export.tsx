import { Header } from '@/components/layout/Header';
import { useTopologySnapshots } from '@/hooks/useTopology';
import { downloadFile, generateDrawioXML, generateTopologyJSON, generateDevicesCSV } from '@/lib/topology/exporter';
import { TopologyData } from '@/types/network';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Download, FileJson, FileSpreadsheet, Image, Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function Export() {
  const { data: snapshots, isLoading } = useTopologySnapshots();

  const handleExportSnapshot = (snapshot: { topology_data: TopologyData; name: string }, format: 'drawio' | 'json' | 'csv') => {
    const timestamp = new Date().toISOString().split('T')[0];
    const baseName = snapshot.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    
    switch (format) {
      case 'drawio':
        const xml = generateDrawioXML(snapshot.topology_data);
        downloadFile(xml, `${baseName}-${timestamp}.drawio`, 'application/xml');
        toast.success('Arquivo draw.io exportado');
        break;
      case 'json':
        const json = generateTopologyJSON(snapshot.topology_data);
        downloadFile(json, `${baseName}-${timestamp}.json`, 'application/json');
        toast.success('Arquivo JSON exportado');
        break;
      case 'csv':
        const csv = generateDevicesCSV(snapshot.topology_data);
        downloadFile(csv, `${baseName}-${timestamp}.csv`, 'text/csv');
        toast.success('Arquivo CSV exportado');
        break;
    }
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Exportar Topologia"
        description="Exporte snapshots para uso em outras ferramentas"
      />

      <div className="p-6">
        {/* Export Options Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <Image className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-base">Draw.io</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Exporta para formato XML compatível com diagrams.net/draw.io
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <FileJson className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-base">JSON</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Dados estruturados para integração com outras ferramentas
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <FileSpreadsheet className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-base">CSV</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Lista de dispositivos para planilhas Excel/Google Sheets
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Snapshots List */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Snapshots Salvos</h2>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : snapshots && snapshots.length > 0 ? (
            <div className="space-y-4">
              {snapshots.map((snapshot) => (
                <Card key={snapshot.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{snapshot.name}</CardTitle>
                        {snapshot.description && (
                          <CardDescription>{snapshot.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(snapshot.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {snapshot.topology_data.metadata?.deviceCount || 0} dispositivos •{' '}
                        {snapshot.topology_data.metadata?.linkCount || 0} links
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportSnapshot(snapshot, 'drawio')}
                          className="gap-1"
                        >
                          <Download className="h-3 w-3" />
                          Draw.io
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportSnapshot(snapshot, 'json')}
                          className="gap-1"
                        >
                          <Download className="h-3 w-3" />
                          JSON
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportSnapshot(snapshot, 'csv')}
                          className="gap-1"
                        >
                          <Download className="h-3 w-3" />
                          CSV
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-muted/20 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Download className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Nenhum snapshot disponível
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Salve snapshots na página de Topologia para exportá-los posteriormente
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
