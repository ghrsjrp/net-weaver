import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { DeviceCard } from '@/components/devices/DeviceCard';
import { DeviceForm } from '@/components/devices/DeviceForm';
import { useDevices, useCreateDevice, useUpdateDevice, useDeleteDevice } from '@/hooks/useDevices';
import { useCollectDevice, useCollectAllDevices } from '@/hooks/useCollection';
import { NetworkDevice, DeviceFormData } from '@/types/network';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, Loader2, Server, RefreshCw } from 'lucide-react';

export default function Devices() {
  const { data: devices, isLoading } = useDevices();
  const createDevice = useCreateDevice();
  const updateDevice = useUpdateDevice();
  const deleteDevice = useDeleteDevice();
  const collectDevice = useCollectDevice();
  const collectAllDevices = useCollectAllDevices();

  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<NetworkDevice | undefined>();
  const [deletingDevice, setDeletingDevice] = useState<NetworkDevice | undefined>();
  const [collectingDeviceId, setCollectingDeviceId] = useState<string | null>(null);

  const filteredDevices = devices?.filter((device) => {
    const query = searchQuery.toLowerCase();
    return (
      device.name.toLowerCase().includes(query) ||
      device.hostname.toLowerCase().includes(query) ||
      device.ip_address.includes(query) ||
      device.vendor.toLowerCase().includes(query)
    );
  });

  const handleSubmit = async (data: DeviceFormData) => {
    if (editingDevice) {
      await updateDevice.mutateAsync({ id: editingDevice.id, data });
    } else {
      await createDevice.mutateAsync(data);
    }
    setIsFormOpen(false);
    setEditingDevice(undefined);
  };

  const handleEdit = (device: NetworkDevice) => {
    setEditingDevice(device);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (deletingDevice) {
      await deleteDevice.mutateAsync(deletingDevice.id);
      setDeletingDevice(undefined);
    }
  };

  const handleCollect = async (device: NetworkDevice) => {
    setCollectingDeviceId(device.id);
    try {
      await collectDevice.mutateAsync({ deviceId: device.id });
    } finally {
      setCollectingDeviceId(null);
    }
  };

  const handleCollectAll = async () => {
    if (!devices || devices.length === 0) return;
    const deviceIds = devices.map(d => d.id);
    await collectAllDevices.mutateAsync(deviceIds);
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Dispositivos"
        description="Gerencie os dispositivos de rede cadastrados"
        actions={
          <div className="flex items-center gap-2">
            {devices && devices.length > 0 && (
              <Button 
                variant="outline" 
                onClick={handleCollectAll}
                disabled={collectAllDevices.isPending}
                className="gap-2"
              >
                {collectAllDevices.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Coletar Todos
              </Button>
            )}
            <Button onClick={() => setIsFormOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Dispositivo
            </Button>
          </div>
        }
      />

      <div className="p-6">
        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, IP, hostname ou vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Device Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredDevices && filteredDevices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDevices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onEdit={handleEdit}
                onDelete={setDeletingDevice}
                onCollect={handleCollect}
                isCollecting={collectingDeviceId === device.id}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
              <Server className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchQuery ? 'Nenhum dispositivo encontrado' : 'Nenhum dispositivo cadastrado'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              {searchQuery
                ? 'Tente ajustar os termos de busca'
                : 'Comece adicionando seu primeiro dispositivo de rede para descobrir a topologia'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsFormOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Dispositivo
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => {
        setIsFormOpen(open);
        if (!open) setEditingDevice(undefined);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDevice ? 'Editar Dispositivo' : 'Novo Dispositivo'}
            </DialogTitle>
            <DialogDescription>
              {editingDevice
                ? 'Atualize as informações do dispositivo'
                : 'Cadastre um novo dispositivo de rede'}
            </DialogDescription>
          </DialogHeader>
          <DeviceForm
            device={editingDevice}
            onSubmit={handleSubmit}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingDevice(undefined);
            }}
            isLoading={createDevice.isPending || updateDevice.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingDevice} onOpenChange={() => setDeletingDevice(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o dispositivo "{deletingDevice?.name}"?
              Esta ação não pode ser desfeita e todos os dados de coleta serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
