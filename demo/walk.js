async (page) => {
  const BASE  = 'http://localhost:8080';
  const API   = 'http://localhost:8081/api';
  const REC_DIR = 'c:/Users/Dana/Desktop/NetNut/Netnut/demo/rec';
  const SIZE  = { width: 1280, height: 800 };

  const browser = page.context().browser();
  const ctx = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: 1,
    recordVideo: { dir: REC_DIR, size: SIZE },
  });
  const p = await ctx.newPage();
  const sleep = (ms) => p.waitForTimeout(ms);
  const t0 = Date.now();

  const SCENES = {
    overview: 11, detail: 10, addfunds: 13, consume: 11,
    insufficient: 10, theme: 6, liveproof: 22, closing: 5,
  };
  const scene = async (id, fn) => {
    const start = Date.now();
    try { if (fn) await fn(); } catch (_) {}
    const rem = SCENES[id] * 1000 - (Date.now() - start);
    if (rem > 0) await sleep(rem);
  };

  // ── Pre-roll: land in dark mode ──────────────────────────────────────────
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.setItem('billing.color-mode', 'dark'));
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await sleep(800);
  const prerollMs = Date.now() - t0;

  // ── Pre-warm: fire several consume + credit calls via the API so metrics
  //    on both replicas are non-zero by the time we reach the metrics page.
  //    We do this quietly in the background while the user sees the dashboard.
  const prefetch = await p.evaluate(async (api) => {
    const customers = await fetch(`${api}/customers?limit=10&offset=0`).then(r => r.json());
    const products  = await fetch(`${api}/products`).then(r => r.json());
    const heavy  = customers.data.find(c => c.name.includes('Heavy')).id;
    const broke  = customers.data.find(c => c.name.includes('Broke')).id;
    const apiProd = products.find(p => p.name.includes('API Calls')).id;
    const prem   = products.find(p => p.name.includes('Premium')).id;
    const post = (url, body, key) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify(body),
      }).then(r => r.status);
    const uid = () => crypto.randomUUID();
    // 6 successful charges on Heavy Corp
    const results = await Promise.all([
      post(`${api}/consumption`, { customerId: heavy, productId: apiProd, quantity: 10 }, uid()),
      post(`${api}/consumption`, { customerId: heavy, productId: apiProd, quantity: 5  }, uid()),
      post(`${api}/consumption`, { customerId: heavy, productId: apiProd, quantity: 20 }, uid()),
      post(`${api}/consumption`, { customerId: heavy, productId: apiProd, quantity: 3  }, uid()),
      post(`${api}/consumption`, { customerId: heavy, productId: apiProd, quantity: 7  }, uid()),
      post(`${api}/consumption`, { customerId: heavy, productId: apiProd, quantity: 15 }, uid()),
    ]);
    // idempotent replay (same key twice)
    const k = uid();
    await post(`${api}/consumption`, { customerId: heavy, productId: apiProd, quantity: 8 }, k);
    await post(`${api}/consumption`, { customerId: heavy, productId: apiProd, quantity: 8 }, k);
    // 3 insufficient-funds on Broke Inc
    await Promise.all([
      post(`${api}/consumption`, { customerId: broke, productId: prem, quantity: 5 }, uid()),
      post(`${api}/consumption`, { customerId: broke, productId: prem, quantity: 3 }, uid()),
      post(`${api}/consumption`, { customerId: broke, productId: prem, quantity: 2 }, uid()),
    ]);
    return results;
  }, API);

  // ── Scene 1: overview ────────────────────────────────────────────────────
  await scene('overview', async () => {
    await p.locator('table tbody tr').first().hover().catch(() => {});
    await sleep(1500);
    await p.mouse.wheel(0, 200);
    await sleep(1500);
    await p.mouse.wheel(0, -200);
  });

  // ── Scene 2: customer detail ─────────────────────────────────────────────
  await scene('detail', async () => {
    await p.locator('table tbody tr').first().click();
    await p.waitForURL(/\/customers\//, { timeout: 8000 }).catch(() => {});
    await sleep(2000);
    await p.mouse.wheel(0, 250);
    await sleep(1500);
    await p.mouse.wheel(0, -250);
  });

  // ── Scene 3: add funds (validation + success) ────────────────────────────
  await scene('addfunds', async () => {
    const amount = p.getByLabel('Amount');
    const addBtn = p.getByRole('button', { name: 'Add funds' });
    await amount.click();
    await amount.type('2000000', { delay: 60 });
    await addBtn.click();
    await sleep(1800);
    await amount.fill('');
    await amount.type('75.00', { delay: 120 });
    await addBtn.click();
    await sleep(2500);
  });

  // ── Scene 4: record consumption (success) ───────────────────────────────
  await scene('consume', async () => {
    await p.getByRole('button', { name: 'Record consumption' }).last().click();
    await sleep(800);
    await p.getByRole('combobox', { name: 'Product' }).click();
    await sleep(500);
    await p.getByRole('option', { name: /Bandwidth GB/ }).first().click();
    await sleep(400);
    await p.getByLabel('Quantity').fill('3');
    await sleep(1000);
    await p.getByRole('button', { name: /^Record$/ }).click();
    await sleep(2500);
  });

  // ── Scene 5: insufficient funds ──────────────────────────────────────────
  await scene('insufficient', async () => {
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await sleep(600);
    await p.getByRole('row', { name: /Broke Inc/ }).click();
    await p.waitForURL(/\/customers\//, { timeout: 8000 }).catch(() => {});
    await sleep(1000);
    await p.getByRole('button', { name: 'Record consumption' }).last().click();
    await sleep(700);
    await p.getByRole('combobox', { name: 'Product' }).click();
    await sleep(400);
    await p.getByRole('option', { name: /Premium Support Minute/ }).first().click();
    await sleep(400);
    await p.getByLabel('Quantity').fill('5');
    await sleep(600);
    await p.getByRole('button', { name: /^Record$/ }).click();
    await sleep(2200);
    await p.keyboard.press('Escape').catch(() => {});
  });

  // ── Scene 6: theme toggle ────────────────────────────────────────────────
  await scene('theme', async () => {
    await p.goto(BASE, { waitUntil: 'networkidle' });
    const toggle = p.getByRole('button', { name: /Switch to (dark|light) theme/ });
    await toggle.click();
    await sleep(1800);
    await toggle.click();
    await sleep(1200);
  });

  // ── Scene 7: LIVE PROOF / METRICS ───────────────────────────────────────
  // Navigate to /system and linger for the full 22 seconds so every counter
  // is clearly visible and both replica cards can be read.
  await scene('liveproof', async () => {
    await p.getByRole('link', { name: 'Live proof' }).click();
    await p.waitForURL(/\/system/, { timeout: 8000 }).catch(() => {});
    // Wait for both replica cards to render
    await p.waitForSelector('text=Backend replica', { timeout: 6000 }).catch(() => {});
    await sleep(4000);                  // hold on the top replica card
    await p.mouse.wheel(0, 340);        // scroll to show second replica
    await sleep(4500);
    await p.mouse.wheel(0, 340);        // scroll to footer "Discovered 2 replicas"
    await sleep(3000);
    await p.mouse.wheel(0, -680);       // scroll back to top
    await sleep(3000);                  // final hold on both cards together
  });

  // ── Scene 8: closing ─────────────────────────────────────────────────────
  await scene('closing', async () => {
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await sleep(2500);
  });

  const video = p.video();
  await ctx.close();
  const videoPath = await video.path();
  return JSON.stringify({ videoPath, prerollMs, prefetchStatuses: prefetch });
};
