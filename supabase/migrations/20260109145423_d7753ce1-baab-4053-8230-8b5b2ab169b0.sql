-- Enum para tipos de vendors suportados
CREATE TYPE public.vendor_type AS ENUM ('huawei', 'juniper', 'mikrotik', 'datacom', 'cisco', 'other');

-- Enum para status do dispositivo
CREATE TYPE public.device_status AS ENUM ('online', 'offline', 'unknown', 'error');

-- Enum para status de coleta
CREATE TYPE public.collection_status AS ENUM ('pending', 'running', 'completed', 'failed');

-- Enum para protocolo de descoberta
CREATE TYPE public.discovery_protocol AS ENUM ('lldp', 'ospf', 'cdp', 'manual');

-- Tabela de dispositivos de rede
CREATE TABLE public.network_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    vendor vendor_type NOT NULL DEFAULT 'huawei',
    model VARCHAR(255),
    serial_number VARCHAR(255),
    os_version VARCHAR(255),
    management_ip INET,
    ssh_port INTEGER DEFAULT 22,
    ssh_username VARCHAR(255),
    ssh_password_encrypted TEXT, -- Será criptografado antes de armazenar
    status device_status DEFAULT 'unknown',
    last_seen TIMESTAMPTZ,
    location VARCHAR(255),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de interfaces de rede
CREATE TABLE public.device_interfaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.network_devices(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    mac_address VARCHAR(17),
    speed_mbps INTEGER,
    admin_status VARCHAR(50),
    oper_status VARCHAR(50),
    vlan_id INTEGER,
    ip_addresses INET[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de vizinhos (LLDP/OSPF/CDP)
CREATE TABLE public.topology_neighbors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_device_id UUID REFERENCES public.network_devices(id) ON DELETE CASCADE NOT NULL,
    local_interface VARCHAR(255) NOT NULL,
    remote_device_id UUID REFERENCES public.network_devices(id) ON DELETE SET NULL,
    remote_device_name VARCHAR(255),
    remote_interface VARCHAR(255),
    remote_ip INET,
    discovery_protocol discovery_protocol NOT NULL,
    raw_data JSONB DEFAULT '{}',
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(local_device_id, local_interface, remote_device_name, discovery_protocol)
);

-- Tabela de links de topologia (normalizada)
CREATE TABLE public.topology_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_device_id UUID REFERENCES public.network_devices(id) ON DELETE CASCADE NOT NULL,
    source_interface VARCHAR(255),
    target_device_id UUID REFERENCES public.network_devices(id) ON DELETE CASCADE NOT NULL,
    target_interface VARCHAR(255),
    link_type VARCHAR(50) DEFAULT 'physical',
    bandwidth_mbps INTEGER,
    status VARCHAR(50) DEFAULT 'up',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_device_id, source_interface, target_device_id, target_interface)
);

-- Tabela de histórico de coletas
CREATE TABLE public.collection_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.network_devices(id) ON DELETE CASCADE NOT NULL,
    collection_type VARCHAR(50) NOT NULL, -- 'lldp', 'ospf', 'interfaces', 'full'
    status collection_status DEFAULT 'pending',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    raw_output TEXT,
    parsed_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de configurações do sistema
CREATE TABLE public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de snapshots de topologia (para exportação)
CREATE TABLE public.topology_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    topology_data JSONB NOT NULL,
    drawio_xml TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_network_devices_ip ON public.network_devices(ip_address);
CREATE INDEX idx_network_devices_vendor ON public.network_devices(vendor);
CREATE INDEX idx_network_devices_status ON public.network_devices(status);
CREATE INDEX idx_topology_neighbors_local ON public.topology_neighbors(local_device_id);
CREATE INDEX idx_topology_neighbors_remote ON public.topology_neighbors(remote_device_id);
CREATE INDEX idx_topology_links_source ON public.topology_links(source_device_id);
CREATE INDEX idx_topology_links_target ON public.topology_links(target_device_id);
CREATE INDEX idx_collection_history_device ON public.collection_history(device_id);
CREATE INDEX idx_collection_history_status ON public.collection_history(status);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_network_devices_updated_at
    BEFORE UPDATE ON public.network_devices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_device_interfaces_updated_at
    BEFORE UPDATE ON public.device_interfaces
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_topology_links_updated_at
    BEFORE UPDATE ON public.topology_links
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_topology_neighbors_updated_at
    BEFORE UPDATE ON public.topology_neighbors
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS - Políticas públicas (sistema interno sem autenticação obrigatória)
ALTER TABLE public.network_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_interfaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topology_neighbors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topology_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topology_snapshots ENABLE ROW LEVEL SECURITY;

-- Políticas públicas para acesso anônimo (sistema interno de NOC)
CREATE POLICY "Allow public read on network_devices" ON public.network_devices FOR SELECT USING (true);
CREATE POLICY "Allow public insert on network_devices" ON public.network_devices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on network_devices" ON public.network_devices FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on network_devices" ON public.network_devices FOR DELETE USING (true);

CREATE POLICY "Allow public read on device_interfaces" ON public.device_interfaces FOR SELECT USING (true);
CREATE POLICY "Allow public insert on device_interfaces" ON public.device_interfaces FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on device_interfaces" ON public.device_interfaces FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on device_interfaces" ON public.device_interfaces FOR DELETE USING (true);

CREATE POLICY "Allow public read on topology_neighbors" ON public.topology_neighbors FOR SELECT USING (true);
CREATE POLICY "Allow public insert on topology_neighbors" ON public.topology_neighbors FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on topology_neighbors" ON public.topology_neighbors FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on topology_neighbors" ON public.topology_neighbors FOR DELETE USING (true);

CREATE POLICY "Allow public read on topology_links" ON public.topology_links FOR SELECT USING (true);
CREATE POLICY "Allow public insert on topology_links" ON public.topology_links FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on topology_links" ON public.topology_links FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on topology_links" ON public.topology_links FOR DELETE USING (true);

CREATE POLICY "Allow public read on collection_history" ON public.collection_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert on collection_history" ON public.collection_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on collection_history" ON public.collection_history FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on collection_history" ON public.collection_history FOR DELETE USING (true);

CREATE POLICY "Allow public read on system_settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert on system_settings" ON public.system_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on system_settings" ON public.system_settings FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on system_settings" ON public.system_settings FOR DELETE USING (true);

CREATE POLICY "Allow public read on topology_snapshots" ON public.topology_snapshots FOR SELECT USING (true);
CREATE POLICY "Allow public insert on topology_snapshots" ON public.topology_snapshots FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on topology_snapshots" ON public.topology_snapshots FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on topology_snapshots" ON public.topology_snapshots FOR DELETE USING (true);

-- Inserir configurações padrão
INSERT INTO public.system_settings (key, value, description) VALUES
('collection_interval', '300', 'Intervalo padrão de coleta em segundos'),
('ssh_timeout', '30', 'Timeout de conexão SSH em segundos'),
('max_concurrent_collections', '5', 'Número máximo de coletas simultâneas'),
('auto_discovery_enabled', 'false', 'Habilitar descoberta automática de vizinhos');