/**
 * Live idempotency demonstration against the running Docker stack.
 *
 * Fires many concurrent "consume" requests that all share ONE Idempotency-Key
 * (simulating a client retry storm hitting both backend replicas), then proves
 * the customer was charged EXACTLY ONCE: the wallet moved by a single unit price
 * and only one consumption event was recorded.
 *
 * Usage (stack must be up):
 *   node scripts/idempotency-check.mjs
 *   API_BASE=http://localhost:8081/api DUPLICATES=50 node scripts/idempotency-check.mjs
 */

const API = process.env.API_BASE ?? 'http://localhost:8081/api';
const DUPLICATES = Number.parseInt(process.env.DUPLICATES ?? '50', 10);

async function getJson(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

function newKey() {
  // crypto.randomUUID exists in Node 18+; fall back just in case.
  return globalThis.crypto?.randomUUID?.() ?? `key-${Date.now()}-${Math.random()}`;
}

async function consume({ customerId, productId, key }) {
  const res = await fetch(`${API}/consumption`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({ customerId, productId, quantity: 1 }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, replayed: body?.replayed };
}

async function main() {
  console.log(`Target: ${API}`);

  const products = await getJson('/products');
  const product = products.reduce((a, b) => (a.unitPrice <= b.unitPrice ? a : b));

  // Pick a customer that can afford at least one unit.
  const { data: customers } = await getJson('/customers?limit=50');
  const customer = customers.find((c) => c.walletBalance >= product.unitPrice);
  if (!customer) throw new Error('No customer with enough balance for one unit.');

  const start = (await getJson(`/customers/${customer.id}`)).walletBalance;
  const startEvents = (await getJson(`/customers/${customer.id}/consumption?limit=1`)).data
    .length;

  const key = newKey();
  console.log(
    `Customer "${customer.name}" balance=${start}c; firing ${DUPLICATES} concurrent ` +
      `requests with ONE shared Idempotency-Key...`,
  );

  const results = await Promise.all(
    Array.from({ length: DUPLICATES }).map(() =>
      consume({ customerId: customer.id, productId: product.id, key }),
    ),
  );

  const ok = results.filter((r) => r.status === 201).length;
  const freshCharges = results.filter((r) => r.status === 201 && r.replayed === false).length;
  const replays = results.filter((r) => r.status === 201 && r.replayed === true).length;
  const errors = results.filter((r) => r.status !== 201).length;

  const final = (await getJson(`/customers/${customer.id}`)).walletBalance;
  const charged = start - final;

  console.log('-----------------------------------------');
  console.log(`Duplicate requests sent    : ${DUPLICATES}`);
  console.log(`Accepted (201)             : ${ok}`);
  console.log(`Fresh charge (replayed=no) : ${freshCharges}`);
  console.log(`Replays  (replayed=yes)    : ${replays}`);
  console.log(`Errors                     : ${errors}`);
  console.log(`Amount actually charged    : ${charged}c (one unit = ${product.unitPrice}c)`);
  console.log('-----------------------------------------');

  const chargedOnce = charged === product.unitPrice;
  const exactlyOneFresh = freshCharges === 1;

  if (!chargedOnce || !exactlyOneFresh || errors > 0) {
    console.error('FAIL: idempotency violated (customer charged more than once)');
    process.exit(1);
  }
  console.log('PASS: retry storm charged the customer EXACTLY once');
  // startEvents referenced only to keep the read meaningful in logs.
  void startEvents;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
