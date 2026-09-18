import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_TEST_URL ?? 'http://127.0.0.1:4321';
const routes = ['/', '/about', '/contact', '/authentic-approach', '/webinar', '/fuck-dating-apps'];

const browser = await chromium.launch();
let failed = false;

for (const route of routes) {
  const url = `${baseUrl}${route}`;
  const page = await browser.newPage();
  const errors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`uncaught exception: ${err.message}`));
  page.on('requestfailed', (req) => {
    errors.push(`request failed: ${req.url()} (${req.failure()?.errorText ?? 'unknown'})`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) errors.push(`bad response: ${res.status()} ${res.url()}`);
  });

  let navigationError = null;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  } catch (err) {
    navigationError = err.message;
  }

  await page.close();

  if (navigationError) {
    failed = true;
    console.error(`\n✗ ${url}`);
    console.error(`  - navigation failed: ${navigationError}`);
  } else if (errors.length > 0) {
    failed = true;
    console.error(`\n✗ ${url}`);
    for (const e of errors) console.error(`  - ${e}`);
  } else {
    console.log(`✓ ${url}`);
  }
}

await browser.close();

if (failed) {
  console.error('\nSmoke tests failed.');
  process.exit(1);
}

console.log('\nAll pages loaded without errors.');
