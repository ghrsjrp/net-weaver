import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NetworkDevice, DeviceFormData, VendorType, DeviceStatus } from '@/types/network';
import { toast } from 'sonner';
import { detectSelfHosted, isSelfHosted, getApiUrl } from '@/lib/api/client';

// Converter dados do banco para tipo TypeScript
function mapDatabaseDevice(data: Record<string, unknown>): NetworkDevice {
  return {
    id: data.id as string,
    name: data.name as string,
    hostname: data.hostname as string,
    ip_address: data.ip_address as string,
    vendor: data.vendor as VendorType,
    model: data.model as string | undefined,
    serial_number: data.serial_number as string | undefined,
    os_version: data.os_version as string | undefined,
    management_ip: data.management_ip as string | undefined,
    ssh_port: (data.ssh_port as number) || 22,
    ssh_username: data.ssh_username as string | undefined,
    ssh_password_encrypted: data.ssh_password_encrypted as string | undefined,
    status: (data.status as DeviceStatus) || 'unknown',
    last_seen: data.last_seen as string | undefined,
    location: data.location as string | undefined,
    description: data.description as string | undefined,
    metadata: (data.metadata as Record<string, unknown>) || {},
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
  };
}

/**
 * Busca dispositivos via API local
 */
async function fetchDevicesFromApi(): Promise<NetworkDevice[]> {
  const baseUrl = getApiUrl();
  const response = await fetch(`${baseUrl}/api/devices`);
  if (!response.ok) throw new Error('Falha ao buscar dispositivos');
  const data = await response.json();
  return data.map((d: Record<string, unknown>) => mapDatabaseDevice(d));
}

/**
 * Busca dispositivos via Supabase
 */
async function fetchDevicesFromSupabase(): Promise<NetworkDevice[]> {
  const { data, error } = await supabase
    .from('network_devices')
    .select('*')
    .order('name', { ascending: true });
  
  if (error) throw error;
  return (data || []).map(d => mapDatabaseDevice(d as Record<string, unknown>));
}

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      await detectSelfHosted();
      
      if (isSelfHosted()) {
        console.log('[Devices] Buscando via API local');
        return fetchDevicesFromApi();
      }
      
      console.log('[Devices] Buscando via Supabase');
      return fetchDevicesFromSupabase();
    },
  });
}

export function useDevice(id: string) {
  return useQuery({
    queryKey: ['devices', id],
    queryFn: async () => {
      await detectSelfHosted();
      
      if (isSelfHosted()) {
        const baseUrl = getApiUrl();
        const response = await fetch(`${baseUrl}/api/devices/${id}`);
        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error('Falha ao buscar dispositivo');
        }
        const data = await response.json();
        return mapDatabaseDevice(data);
      }
      
      const { data, error } = await supabase
        .from('network_devices')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      return mapDatabaseDevice(data as Record<string, unknown>);
    },
    enabled: !!id,
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (formData: DeviceFormData) => {
      await detectSelfHosted();
      
      const deviceData = {
        name: formData.name,
        hostname: formData.hostname,
        ip_address: formData.ip_address,
        vendor: formData.vendor,
        model: formData.model || null,
        location: formData.location || null,
        description: formData.description || null,
        ssh_port: formData.ssh_port,
        ssh_username: formData.ssh_username || null,
        ssh_password_encrypted: formData.ssh_password || null,
        status: 'unknown' as const,
        metadata: {},
      };
      
      if (isSelfHosted()) {
        const baseUrl = getApiUrl();
        const response = await fetch(`${baseUrl}/api/devices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(deviceData),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao criar dispositivo');
        }
        return mapDatabaseDevice(await response.json());
      }
      
      const { data, error } = await supabase
        .from('network_devices')
        .insert([deviceData])
        .select()
        .single();
      
      if (error) throw error;
      return mapDatabaseDevice(data as Record<string, unknown>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Dispositivo cadastrado com sucesso');
    },
    onError: (error) => {
      toast.error(`Erro ao cadastrar dispositivo: ${error.message}`);
    },
  });
}

export function useUpdateDevice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DeviceFormData> }) => {
      await detectSelfHosted();
      
      const updateData: Record<string, unknown> = {};
      
      if (data.name !== undefined) updateData.name = data.name;
      if (data.hostname !== undefined) updateData.hostname = data.hostname;
      if (data.ip_address !== undefined) updateData.ip_address = data.ip_address;
      if (data.vendor !== undefined) updateData.vendor = data.vendor;
      if (data.model !== undefined) updateData.model = data.model || null;
      if (data.location !== undefined) updateData.location = data.location || null;
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.ssh_port !== undefined) updateData.ssh_port = data.ssh_port;
      if (data.ssh_username !== undefined) updateData.ssh_username = data.ssh_username || null;
      if (data.ssh_password !== undefined) updateData.ssh_password_encrypted = data.ssh_password || null;
      
      if (isSelfHosted()) {
        const baseUrl = getApiUrl();
        const response = await fetch(`${baseUrl}/api/devices/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao atualizar dispositivo');
        }
        return mapDatabaseDevice(await response.json());
      }
      
      const { data: result, error } = await supabase
        .from('network_devices')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return mapDatabaseDevice(result as Record<string, unknown>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Dispositivo atualizado com sucesso');
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar dispositivo: ${error.message}`);
    },
  });
}

export function useDeleteDevice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await detectSelfHosted();
      
      if (isSelfHosted()) {
        const baseUrl = getApiUrl();
        const response = await fetch(`${baseUrl}/api/devices/${id}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao remover dispositivo');
        }
        return;
      }
      
      const { error } = await supabase
        .from('network_devices')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Dispositivo removido com sucesso');
    },
    onError: (error) => {
      toast.error(`Erro ao remover dispositivo: ${error.message}`);
    },
  });
}

export function useDeviceStats() {
  const { data: devices } = useDevices();
  
  return {
    total: devices?.length || 0,
    online: devices?.filter(d => d.status === 'online').length || 0,
    offline: devices?.filter(d => d.status === 'offline').length || 0,
    unknown: devices?.filter(d => d.status === 'unknown').length || 0,
    byVendor: devices?.reduce((acc, d) => {
      acc[d.vendor] = (acc[d.vendor] || 0) + 1;
      return acc;
    }, {} as Record<VendorType, number>) || {},
  };
}
