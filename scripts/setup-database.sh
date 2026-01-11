#!/bin/bash
# NetTopo Database Setup Script

DB_USER=${1:-nettopo}
DB_PASSWORD=${2:-nettopo}
DB_NAME=${3:-nettopo}

echo "Setting up database schema..."

PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME << 'EOSQL'

-- Create enums
DO $$ BEGIN
    CREATE TYPE vendor_type AS ENUM ('huawei', 'juniper', 'mikrotik', 'datacom', 'cisco', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE device_status AS ENUM ('online', 'offline', 'unknown', 'error');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE collection_status AS ENUM ('pending', 'running', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE discovery_protocol AS ENUM ('lldp', 'ospf', 'cdp', 'manual');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Network devices table
CREATE TABLE IF NOT EXISTS network_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    vendor vendor_type DEFAULT 'huawei',
    model VARCHAR(255),
    serial_number VARCHAR(255),
    os_version VARCHAR(255),
    management_ip INET,
    ssh_port INTEGER DEFAULT 22,
    ssh_username VARCHAR(255),
    ssh_password_encrypted TEXT,
    status device_status DEFAULT 'unknown',
    last_seen TIMESTAMPTZ,
    location VARCHAR(255),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device interfaces table
CREATE TABLE IF NOT EXISTS device_interfaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES network_devices(id) ON DELETE CASCADE,
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
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(device_id, name)
);

-- Topology neighbors table
CREATE TABLE IF NOT EXISTS topology_neighbors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_device_id UUID NOT NULL REFERENCES network_devices(id) ON DELETE CASCADE,
    local_interface VARCHAR(255) NOT NULL,
    remote_device_id UUID REFERENCES network_devices(id) ON DELETE SET NULL,
    remote_device_name VARCHAR(255),
    remote_interface VARCHAR(255),
    remote_ip INET,
    discovery_protocol discovery_protocol NOT NULL,
    raw_data JSONB DEFAULT '{}',
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(local_device_id, local_interface, discovery_protocol)
);

-- Topology links table
CREATE TABLE IF NOT EXISTS topology_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_device_id UUID NOT NULL REFERENCES network_devices(id) ON DELETE CASCADE,
    source_interface VARCHAR(255),
    target_device_id UUID NOT NULL REFERENCES network_devices(id) ON DELETE CASCADE,
    target_interface VARCHAR(255),
    link_type VARCHAR(50) DEFAULT 'physical',
    bandwidth_mbps INTEGER,
    status VARCHAR(50) DEFAULT 'up',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collection history table
CREATE TABLE IF NOT EXISTS collection_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES network_devices(id) ON DELETE CASCADE,
    collection_type VARCHAR(255) NOT NULL,
    status collection_status DEFAULT 'pending',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    raw_output TEXT,
    parsed_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Topology snapshots table
CREATE TABLE IF NOT EXISTS topology_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    topology_data JSONB NOT NULL,
    drawio_xml TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_devices_status ON network_devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_vendor ON network_devices(vendor);
CREATE INDEX IF NOT EXISTS idx_neighbors_local ON topology_neighbors(local_device_id);
CREATE INDEX IF NOT EXISTS idx_links_source ON topology_links(source_device_id);
CREATE INDEX IF NOT EXISTS idx_links_target ON topology_links(target_device_id);
CREATE INDEX IF NOT EXISTS idx_history_device ON collection_history(device_id);

EOSQL

echo "Database schema created successfully!"
