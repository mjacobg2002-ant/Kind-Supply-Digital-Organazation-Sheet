export async function providerWorkspace(db) {
  if (process.env.INTEGRATION_WORKSPACE_ID) return process.env.INTEGRATION_WORKSPACE_ID;
  const { rows } = await db.query("SELECT workspace_id FROM crm_provider_bindings WHERE provider='primary'");
  return rows[0]?.workspace_id || '';
}
