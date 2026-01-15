import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TopologyLink, TopologyNeighbor, TopologySnapshot, TopologyData, DiscoveryProtocol } from '@/types/network';
import { useDevices } from './useDevices';
import { generateTopologyData, calculateLayout } from '@/lib/topology/normalizer';
import { generateDrawioXML, generateTopologyJSON, downloadFile } from '@/lib/topology/exporter';
import { toast } from 'sonner';
import { detectSelfHosted, isSelfHosted, getApiUrl } from '@/lib/api/client';

function mapDatabaseLink(data: Record<string, unknown>): TopologyLink {
  return {
    id: data.id as string,
    source_device_id: data.source_device_id as string,
    source_interface: data.source_interface as string | undefined,
    target_device_id: data.target_device_id as string,
    target_interface: data.target_interface as string | undefined,
    link_type: (data.link_type as string) || 'physical',
    bandwidth_mbps: (data.bandwidth_mbps as number | null | undefined) ?? null,
    status: (data.status as string) || 'up',
    metadata: (data.metadata as Record<string, unknown>) || {},
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
  };
}


function mapDatabaseNeighbor(data: Record<string, unknown>): TopologyNeighbor {
  return {
    id: data.id as string,
    local_device_id: data.local_device_id as string,
    local_interface: data.local_interface as string,
    remote_device_id: data.remote_device_id as string | undefined,
    remote_device_name: data.remote_device_name as string | undefined,
    remote_interface: data.remote_interface as string | undefined,
    remote_ip: data.remote_ip as string | undefined,
    discovery_protocol: data.discovery_protocol as DiscoveryProtocol,
    raw_data: (data.raw_data as Record<string, unknown>) || {},
    discovered_at: data.discovered_at as string,
    last_updated: data.last_updated as string,
  };
}

function mapDatabaseSnapshot(data: Record<string, unknown>): TopologySnapshot {
  return {
    id: data.id as string,
    name: data.name as string,
    description: data.description as string | undefined,
    topology_data: data.topology_data as TopologyData,
    drawio_xml: data.drawio_xml as string | undefined,
    created_at: data.created_at as string,
  };
}

export function useTopologyLinks() {
  return useQuery({
    queryKey: ['topology-links'],
    queryFn: async () => {
      await detectSelfHosted();
      
      if (isSelfHosted()) {
        const baseUrl = getApiUrl();
        const response = await fetch(`${baseUrl}/api/topology/links`);
        if (!response.ok) throw new Error('Falha ao buscar links');
        const data = await response.json();
        return data.map((d: Record<string, unknown>) => mapDatabaseLink(d));
      }
      
      const { data, error } = await supabase
        .from('topology_links')
        .select('*');
      
      if (error) throw error;
      return (data || []).map(d => mapDatabaseLink(d as Record<string, unknown>));
    },
  });
}

export function useTopologyNeighbors() {
  return useQuery({
    queryKey: ['topology-neighbors'],
    queryFn: async () => {
      await detectSelfHosted();
      
      if (isSelfHosted()) {
        const baseUrl = getApiUrl();
        const response = await fetch(`${baseUrl}/api/topology/neighbors`);
        if (!response.ok) throw new Error('Falha ao buscar vizinhos');
        const data = await response.json();
        return data.map((d: Record<string, unknown>) => mapDatabaseNeighbor(d));
      }
      
      const { data, error } = await supabase
        .from('topology_neighbors')
        .select('*');
      
      if (error) throw error;
      return (data || []).map(d => mapDatabaseNeighbor(d as Record<string, unknown>));
    },
  });
}

export function useTopologyData() {
  const { data: devices, isLoading: devicesLoading } = useDevices();
  const { data: links, isLoading: linksLoading } = useTopologyLinks();
  
  const isLoading = devicesLoading || linksLoading;
  
  let topologyData: TopologyData | null = null;
  
  if (devices && links) {
    topologyData = generateTopologyData(devices, links);
    // Aplicar layout automático
    topologyData.nodes = calculateLayout(topologyData.nodes, topologyData.edges);
  }
  
  return {
    data: topologyData,
    isLoading,
  };
}

export function useTopologySnapshots() {
  return useQuery({
    queryKey: ['topology-snapshots'],
    queryFn: async () => {
      await detectSelfHosted();
      
      if (isSelfHosted()) {
        const baseUrl = getApiUrl();
        const response = await fetch(`${baseUrl}/api/topology/snapshots`);
        if (!response.ok) throw new Error('Falha ao buscar snapshots');
        const data = await response.json();
        return data.map((d: Record<string, unknown>) => mapDatabaseSnapshot(d));
      }
      
      const { data, error } = await supabase
        .from('topology_snapshots')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(d => mapDatabaseSnapshot(d as Record<string, unknown>));
    },
  });
}

export function useSaveTopologySnapshot() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ name, description, topology }: { 
      name: string; 
      description?: string; 
      topology: TopologyData 
    }) => {
      await detectSelfHosted();
      
      const drawioXml = generateDrawioXML(topology);
      const snapshotData = {
        name,
        description,
        topology_data: JSON.parse(JSON.stringify(topology)),
        drawio_xml: drawioXml,
      };
      
      if (isSelfHosted()) {
        const baseUrl = getApiUrl();
        const response = await fetch(`${baseUrl}/api/topology/snapshots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snapshotData),
        });
        if (!response.ok) throw new Error('Erro ao salvar snapshot');
        return mapDatabaseSnapshot(await response.json());
      }
      
      const { data, error } = await supabase
        .from('topology_snapshots')
        .insert([snapshotData])
        .select()
        .single();
      
      if (error) throw error;
      return mapDatabaseSnapshot(data as Record<string, unknown>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topology-snapshots'] });
      toast.success('Snapshot salvo com sucesso');
    },
    onError: (error) => {
      toast.error(`Erro ao salvar snapshot: ${error.message}`);
    },
  });
}

export function useExportTopology() {
  return {
    exportDrawio: (topology: TopologyData, filename: string = 'topology.drawio') => {
      const xml = generateDrawioXML(topology);
      downloadFile(xml, filename, 'application/xml');
      toast.success('Arquivo draw.io exportado');
    },
    exportJSON: (topology: TopologyData, filename: string = 'topology.json') => {
      const json = generateTopologyJSON(topology);
      downloadFile(json, filename, 'application/json');
      toast.success('Arquivo JSON exportado');
    },
  };
}

export function useCreateManualLink() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (link: Omit<TopologyLink, 'id' | 'created_at' | 'updated_at'>) => {
      await detectSelfHosted();
      
      const linkData = {
        source_device_id: link.source_device_id,
        source_interface: link.source_interface,
        target_device_id: link.target_device_id,
        target_interface: link.target_interface,
        link_type: link.link_type,
        bandwidth_mbps: link.bandwidth_mbps,
        status: link.status,
        metadata: JSON.parse(JSON.stringify(link.metadata)),
      };
      
      if (isSelfHosted()) {
        const baseUrl = getApiUrl();
        const response = await fetch(`${baseUrl}/api/topology/links`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(linkData),
        });
        if (!response.ok) throw new Error('Erro ao criar link');
        return mapDatabaseLink(await response.json());
      }
      
      const { data, error } = await supabase
        .from('topology_links')
        .insert([linkData])
        .select()
        .single();
      
      if (error) throw error;
      return mapDatabaseLink(data as Record<string, unknown>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topology-links'] });
      toast.success('Link criado com sucesso');
    },
    onError: (error) => {
      toast.error(`Erro ao criar link: ${error.message}`);
    },
  });
}

export function useDeleteLink() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await detectSelfHosted();
      
      if (isSelfHosted()) {
        const baseUrl = getApiUrl();
        const response = await fetch(`${baseUrl}/api/topology/links/${id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Erro ao remover link');
        return;
      }
      
      const { error } = await supabase
        .from('topology_links')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topology-links'] });
      toast.success('Link removido');
    },
    onError: (error) => {
      toast.error(`Erro ao remover link: ${error.message}`);
    },
  });
}
