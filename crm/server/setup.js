import { database, migrate } from './db.js';
import { bootstrap } from './security.js';

const db = database();
try {
  await migrate(db);
  if (process.argv.includes('--migrate-only')) {
    console.log('Database schema is ready.');
  } else {
    const email = process.env.OWNER_EMAIL;
    const password = process.env.OWNER_PASSWORD;
    if (!email || !password) throw new Error('Set OWNER_EMAIL and OWNER_PASSWORD before bootstrapping an owner.');
    const result = await bootstrap(db, {
      email, password,
      name: process.env.OWNER_NAME || email.split('@')[0],
      workspace: process.env.WORKSPACE_NAME || 'Kind Supply Digital'
    });
    console.log(`Created workspace "${result.name}". You can now sign in as ${email}.`);
  }
} finally {
  await db.end();
}
