'use strict';

/**
 * Verifies MONGO_URI before you bother starting the app.
 *
 *   npm run db:check
 *
 * Prints where it is pointing, whether it can connect, and what is in there.
 * Translates the usual Atlas failures into the actual fix rather than a stack
 * trace.
 */

const mongoose = require('mongoose');
const config = require('./../config/env');

/** Hides the password so the URI is safe to print. */
function redact(uri) {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, (_, user) => `//${user}:********@`);
}

function describe(uri) {
  const isSrv = uri.startsWith('mongodb+srv://');
  const isLocal = /\/\/(127\.0\.0\.1|localhost)/.test(uri);
  // Database name is the path segment after the host, before any query string.
  const dbName = (uri.split('/')[3] || '').split('?')[0];

  console.log(`  target   : ${redact(uri)}`);
  console.log(`  kind     : ${isSrv ? 'MongoDB Atlas (SRV)' : isLocal ? 'local mongod' : 'remote MongoDB'}`);
  console.log(`  database : ${dbName || '(none given — MongoDB will use "test")'}`);

  if (isSrv && !dbName) {
    console.log('');
    console.log('  WARNING: no database name in the URI. Add /crm before the "?" —');
    console.log('           ...mongodb.net/crm?retryWrites=true&w=majority');
  }
  return { isSrv, dbName };
}

/** Maps the common driver errors onto what actually needs changing. */
function explain(err) {
  const msg = err.message || '';

  if (/bad auth|Authentication failed/i.test(msg)) {
    return [
      'Authentication failed — the username or password is wrong.',
      '  - Check the DB user under Atlas → Database Access (this is NOT your Atlas login).',
      '  - If the password contains @ : / ? # [ ] or %, it must be percent-encoded',
      '    in the URI (for example @ becomes %40).',
    ];
  }
  if (/ENOTFOUND|querySrv|getaddrinfo/i.test(msg)) {
    return [
      'The cluster hostname could not be resolved.',
      '  - Re-copy the string from Atlas → Connect → Drivers.',
      '  - It should start with mongodb+srv:// and end in .mongodb.net',
    ];
  }
  if (/IP address|not whitelisted|whitelist|ETIMEDOUT|timed out/i.test(msg)) {
    return [
      'Could not reach the cluster — almost always the IP allowlist.',
      '  - Atlas → Network Access → Add IP Address.',
      '  - "Add Current IP Address" for local work, or 0.0.0.0/0 for a deployed API.',
    ];
  }
  if (/ECONNREFUSED/i.test(msg)) {
    return ['Connection refused — nothing is listening there. Is the host/port right?'];
  }
  return [`Connection failed: ${msg}`];
}

(async () => {
  console.log('');
  console.log('Checking the database connection...');
  console.log('');
  describe(config.MONGO_URI);
  console.log('');

  try {
    await mongoose.connect(config.MONGO_URI, { serverSelectionTimeoutMS: 12000 });

    const admin = mongoose.connection.db.admin();
    const info = await admin.serverStatus().catch(() => null);

    console.log('  CONNECTED');
    if (info) console.log(`  server   : MongoDB ${info.version}`);
    console.log(`  db in use: ${mongoose.connection.name}`);
    console.log('');

    const cols = await mongoose.connection.db.listCollections().toArray();
    if (!cols.length) {
      console.log('  This database is empty. The 6 default board columns will be created');
      console.log('  the first time you start the API (npm run dev).');
    } else {
      console.log('  Contents:');
      for (const c of cols.sort((a, b) => a.name.localeCompare(b.name))) {
        const n = await mongoose.connection.db.collection(c.name).countDocuments();
        console.log(`    ${c.name.padEnd(14)} ${n} document(s)`);
      }
    }

    console.log('');
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.log('  FAILED');
    console.log('');
    explain(err).forEach((line) => console.log(`  ${line}`));
    console.log('');
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
})();
