import { database, migrate } from './db.js';
import { bootstrap, emailAddress, validPassword } from './security.js';

const optional = process.argv.includes('--if-configured');
const migrateOnly = process.argv.includes('--migrate-only');

async function prepare() {
  if (optional && !process.env.DATABASE_URL) {
    console.log('Database setup skipped for this build.');
    return;
  }
  const db = database();
  try {
    await migrate(db);
    const email = process.env.OWNER_EMAIL;
    const password = process.env.OWNER_PASSWORD;
    if (migrateOnly || (optional && !email && !password)) {
      console.log('Database schema is ready.');
      return;
    }
    if (!email || !password) throw new Error('Set OWNER_EMAIL and OWNER_PASSWORD before bootstrapping an owner.');
    const address = emailAddress(email);
    const { rows } = await db.query('SELECT id,password FROM crm_users WHERE email=$1', [address]);
    if (rows[0]) {
      const member = await db.query("SELECT 1 FROM crm_memberships WHERE user_id=$1 AND role='owner'", [rows[0].id]);
      if (!member.rows.length || !await validPassword(password, rows[0].password)) {
        throw new Error('An account already exists. Sign in with its current credentials to manage it.');
      }
      console.log('Workspace owner is ready.');
      return;
    }
    await bootstrap(db, {
      email:address, password,
      name:process.env.OWNER_NAME || address.split('@')[0],
      workspace:process.env.WORKSPACE_NAME || 'Kind Supply Digital'
    });
    console.log('Created the workspace owner.');
  } finally {
    await db.end();
  }
}

prepare().catch(error => {
  const safeErrors = [
    'Set OWNER_EMAIL and OWNER_PASSWORD before bootstrapping an owner.',
    'An account already exists. Sign in with its current credentials to manage it.',
    'Use a password between 8 and 256 characters.',
    'Enter a valid email address.'
  ];
  console.error(safeErrors.includes(error.message) ? error.message : 'Database setup failed. Check the configured database connection.');
  process.exitCode = 1;
});
