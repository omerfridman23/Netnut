/**
 * Chaos test: kill a backend replica mid-load and prove consistency survives.
 *
 * While a burst of concurrent consume requests is in flight against the gateway,
 * this script `docker kill`s ONE of the two backend replicas. Requests that were
 * being served by the dying instance fail (connection reset / 502) — but the
 * wallet must STILL be perfectly consistent afterwards, because every charge is a
 * single atomic transaction. A half-applied charge is impossible.
 *
 * Proves: balance == start - (successful charges * price), and never negative,
 * even when an instance disappears under load.
 *
 * Usage (the Docker stack must be up):
 *   node scripts/chaos-check.mjs
 *   API_BASE=http://localhost:8081/api ATTEMPTS=300 node scripts/chaos-check.mjs
 *
 * The killed replica is restarted at the end so the stack returns to 2 replicas.
 */
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.API_BASE ?? 'http://localhost:8081/api';
const ATTEMPTS = Number.parseInt(process.env.ATTEMPTS ?? '300', 10);
const UNIT = 1; // quantity per request
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function docker(cmd) {
  return execSync(`docker ${cmd}`, { cwd: ROOT, encoding: 'utf8' }).trim();
}

async function getJson(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`Target: ${API}`);

  // Identify the backend replicas.
  const ids = docker('compose ps -q backend').split('\n').filter(Boolean);
  if (ids.length < 2) {
    throw new Error(`Expected >=2 backend replicas, found ${ids.length}. Is the stack up?`);
  }
  const victim = ids[0];
  console.log(`Backend replicas: ${ids.length}. Will kill ${victim.slice(0, 12)} mid-load.`);

  // Pick the cheapest product + first customer, and top the wallet up so the run
  // is bounded by the crash, not by running out of funds.
  const products = await getJson('/products');
  const product = products.reduce((a, b) => (a.unitPrice <= b.unitPrice ? a : b));
  const { data: customers } = await getJson('/customers?limit=50');
  if (!customers.length) throw new Error('No customers found. Did the seed run?');
  const customer = customers[0];

  const topUp = ATTEMPTS * product.unitPrice * UNIT;
  await fetch(`${API}/customers/${customer.id}/credit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amountCents: topUp }),
  });

  const start = (await getJson(`/customers/${customer.id}`)).walletBalance;
  console.log(
    `Customer "${customer.name}" balance=${start}c; firing ${ATTEMPTS} concurrent charges ` +
      `of ${product.unitPrice}c while killing a replica...`,
  );

  // Fire everything concurrently; kill one replica shortly after the burst starts.
  let killed = false;
  const killTimer = sleep(120).then(() => {
    try {
      docker(`kill ${victim}`);
      killed = true;
      console.log(`>>> killed replica ${victim.slice(0, 12)} mid-flight`);
    } catch (err) {
      console.warn('kill failed:', err.message);
    }
  });

  const results = await Promise.allSettled(
    Array.from({ length: ATTEMPTS }).map(() =>
      fetch(`${API}/consumption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          productId: product.id,
          quantity: UNIT,
        }),
      }).then((r) => r.status),
    ),
  );
  await killTimer;

  const statuses = results.map((r) => (r.status === 'fulfilled' ? r.value : 'ERR'));
  const ok = statuses.filter((s) => s === 201).length;
  const insufficient = statuses.filter((s) => s === 422).length;
  const failed = statuses.filter((s) => s !== 201 && s !== 422).length;

  // Let nginx notice the dead upstream, then read the authoritative final state.
  await sleep(500);
  const final = (await getJson(`/customers/${customer.id}`)).walletBalance;
  const expected = start - ok * product.unitPrice * UNIT;

  console.log('-----------------------------------------');
  console.log(`Replica killed mid-load    : ${killed ? 'yes' : 'no'}`);
  console.log(`Succeeded (201)            : ${ok}`);
  console.log(`Insufficient funds (422)   : ${insufficient}`);
  console.log(`Failed (crash/connection)  : ${failed}`);
  console.log(`Final balance              : ${final}c`);
  console.log(`Expected (start - ok*price): ${expected}c`);
  console.log(`Never negative             : ${final >= 0}`);
  console.log(`Math consistent            : ${final === expected}`);
  console.log('-----------------------------------------');

  // Restore the killed replica so the stack returns to full strength.
  // `compose start` restarts the stopped container WITHOUT re-running the
  // one-shot `migrate` dependency (which `compose up` would re-trigger).
  console.log('Restarting the killed replica...');
  try {
    docker('compose start backend');
  } catch (err) {
    console.warn('Could not auto-restart replica:', err.message);
    console.warn('Restart manually with: docker compose start backend');
  }

  if (final < 0 || final !== expected) {
    console.error('FAIL: wallet inconsistent after replica crash');
    process.exit(1);
  }
  console.log('PASS: wallet stayed perfectly consistent despite a replica dying mid-load');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
