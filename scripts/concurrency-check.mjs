/**
 * Live concurrency demonstration against the running Docker stack.
 *
 * Unlike the in-process Vitest test, this hammers the gateway, so requests are
 * load-balanced across BOTH backend replicas — proving the wallet stays correct
 * even when concurrent writes originate from multiple instances sharing one
 * SQLite file.
 *
 * Usage (stack must be up):
 *   node scripts/concurrency-check.mjs
 *   API_BASE=http://localhost:8081/api ATTEMPTS=200 node scripts/concurrency-check.mjs
 */

const API = process.env.API_BASE ?? 'http://localhost:8081/api';
const ATTEMPTS = Number.parseInt(process.env.ATTEMPTS ?? '100', 10);
const QUANTITY = 1;

async function getJson(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

async function main() {
  console.log(`Target: ${API}`);

  // Pick the cheapest product and any customer.
  const products = await getJson('/products');
  const product = products.reduce((a, b) => (a.unitPrice <= b.unitPrice ? a : b));

  const { data: customers } = await getJson('/customers?limit=50');
  if (!customers.length) throw new Error('No customers found. Did the seed run?');
  const customer = customers[0];

  const start = (await getJson(`/customers/${customer.id}`)).walletBalance;
  const affordable = Math.floor(start / product.unitPrice);

  console.log(
    `Customer "${customer.name}" balance=${start}c, product "${product.name}" ${product.unitPrice}c/unit`,
  );
  console.log(
    `Firing ${ATTEMPTS} concurrent consume requests (affordable: ${affordable})...`,
  );

  // Track which backend instance served requests (via the health endpoint).
  // We sample enough times to reliably hit BOTH replicas through nginx's
  // round-robin load balancing.
  const instances = new Set();
  const HEALTH_SAMPLES = 10;
  await Promise.all(
    Array.from({ length: HEALTH_SAMPLES }).map(async () => {
      try {
        instances.add((await getJson('/health')).instance);
      } catch {
        /* ignore */
      }
    }),
  );

  // The whole point of this proof is multi-instance safety: the wallet must stay
  // correct when concurrent writes originate from MORE THAN ONE backend replica
  // sharing the same SQLite file. If only a single instance ever answers, the
  // concurrency guarantee is untested and the "multi-instance" claim is hollow —
  // so fail loudly rather than reporting a green run that proved nothing.
  if (instances.size < 2) {
    console.error(
      `FAIL: expected >=2 distinct backend instances, observed ${instances.size} ` +
        `(${[...instances].join(', ') || 'none'}) across ${HEALTH_SAMPLES} /health samples.`,
    );
    console.error(
      'This proof requires traffic to be load-balanced across both replicas; with ' +
        'only one instance serving requests the multi-instance concurrency claim is unproven.',
    );
    process.exit(1);
  }

  const results = await Promise.all(
    Array.from({ length: ATTEMPTS }).map(async () => {
      const res = await fetch(`${API}/consumption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          productId: product.id,
          quantity: QUANTITY,
        }),
      });
      return res.status;
    }),
  );

  const ok = results.filter((s) => s === 201).length;
  const insufficient = results.filter((s) => s === 422).length;
  const other = results.filter((s) => s !== 201 && s !== 422).length;

  const final = (await getJson(`/customers/${customer.id}`)).walletBalance;
  const expected = start - ok * product.unitPrice * QUANTITY;

  console.log('-----------------------------------------');
  console.log(`Backend instances observed : ${[...instances].join(', ') || 'n/a'}`);
  console.log(`Succeeded (201)            : ${ok}`);
  console.log(`Insufficient funds (422)   : ${insufficient}`);
  console.log(`Other/errors               : ${other}`);
  console.log(`Final balance              : ${final}c`);
  console.log(`Expected balance           : ${expected}c`);
  console.log(`Never negative             : ${final >= 0}`);
  console.log(`Math consistent            : ${final === expected}`);
  console.log('-----------------------------------------');

  if (final < 0 || final !== expected || other > 0) {
    console.error('FAIL: invariants violated');
    process.exit(1);
  }
  console.log('PASS: wallet stayed consistent across concurrent, multi-instance load');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
