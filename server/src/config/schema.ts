import { query, queryOne } from './database';

const REQUIRED_TABLES = [
  'network_devices',
  'device_interfaces',
  'topology_neighbors',
  'topology_links',
  'collection_history',
  'topology_snapshots',
  'system_settings',
] as const;

const REQUIRED_NEIGHBOR_COLUMNS = [
  'local_device_id',
  'local_interface',
  'remote_device_id',
  'remote_device_name',
  'remote_interface',
  'remote_ip',
  'discovery_protocol',
  'raw_data',
  'discovered_at',
  'last_updated',
] as const;

export async function validateSchema(): Promise<void> {
  const missingTables: string[] = [];

  for (const table of REQUIRED_TABLES) {
    const row = await queryOne<{ reg: string | null }>(
      `SELECT to_regclass($1) as reg`,
      [`public.${table}`]
    );

    if (!row?.reg) missingTables.push(table);
  }

  if (missingTables.length > 0) {
    throw new Error(
      `Schema do banco incompleto. Tabelas ausentes: ${missingTables.join(', ')}. ` +
        `Se você atualizou o sistema e o volume do Postgres já existia, ` +
        `recrie o volume (pgdata) ou rode o script de inicialização do banco novamente.`
    );
  }

  // Validate critical columns for topology_neighbors
  const cols = await query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'topology_neighbors'`
  );
  const colSet = new Set(cols.map((c) => c.column_name));

  const missingCols = REQUIRED_NEIGHBOR_COLUMNS.filter((c) => !colSet.has(c));
  if (missingCols.length > 0) {
    throw new Error(
      `Schema do banco incompatível: topology_neighbors sem colunas: ${missingCols.join(', ')}.`
    );
  }

  // Ensure we have a UNIQUE constraint for ON CONFLICT (local_device_id, local_interface, discovery_protocol)
  const uniqueOk = await queryOne<{ ok: number }>(
    `SELECT 1 as ok
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = 'topology_neighbors'
       AND c.contype = 'u'
       AND (
         SELECT array_agg(att.attname ORDER BY att.attname)
         FROM unnest(c.conkey) AS k(attnum)
         JOIN pg_attribute att ON att.attrelid = t.oid AND att.attnum = k.attnum
       ) @> ARRAY['local_device_id','local_interface','discovery_protocol']::text[]
     LIMIT 1`
  );

  if (!uniqueOk) {
    throw new Error(
      `Schema do banco incompatível: topology_neighbors precisa de UNIQUE(local_device_id, local_interface, discovery_protocol) ` +
        `para o ON CONFLICT funcionar corretamente.`
    );
  }
}
