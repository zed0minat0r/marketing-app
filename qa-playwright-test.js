const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FILE_URL = 'file:///tmp/marketing-app/index.html';
const SCREENSHOT_DIR = '/tmp/marketing-app/qa-screenshots-375';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const results = [];
  const log = (msg) => { console.log(msg); results.push(msg); };

  // Full page screenshot
  await page.screenshot({ path: `${SCREENSHOT_DIR}/00-full-page.png`, fullPage: true });

  // ---- CHECK 1: Horizontal overflow ----
  const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = 375;
  if (bodyScrollWidth > viewportWidth) {
    log(`BUG: Horizontal overflow detected. body.scrollWidth=${bodyScrollWidth}px (viewport=${viewportWidth}px)`);
  } else {
    log(`OK: No horizontal overflow. body.scrollWidth=${bodyScrollWidth}px`);
  }

  // ---- CHECK 2: "Save 20%" pill visibility when Monthly is active ----
  const savePillVisible = await page.evaluate(() => {
    const pill = document.querySelector('.pricing__toggle-save');
    if (!pill) return 'ELEMENT_NOT_FOUND';
    const style = window.getComputedStyle(pill);
    const rect = pill.getBoundingClientRect();
    return {
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      width: rect.width,
      height: rect.height,
    };
  });
  log(`Save 20% pill on Monthly (should be hidden): ${JSON.stringify(savePillVisible)}`);

  // Switch to Annual
  await page.click('#toggleAnnual');
  await page.waitForTimeout(300);
  const savePillAfterAnnual = await page.evaluate(() => {
    const pill = document.querySelector('.pricing__toggle-save');
    if (!pill) return 'ELEMENT_NOT_FOUND';
    const style = window.getComputedStyle(pill);
    return {
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
    };
  });
  log(`Save 20% pill on Annual (should be visible): ${JSON.stringify(savePillAfterAnnual)}`);

  // Switch back to monthly
  await page.click('#toggleMonthly');
  await page.waitForTimeout(300);

  // ---- CHECK 3: Compare table - is Sidekick column visible? ----
  await page.evaluate(() => {
    document.querySelector('.compare').scrollIntoView();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/01-compare-table.png` });

  const tableInfo = await page.evaluate(() => {
    const scrollWrap = document.querySelector('.compare__scroll');
    const table = document.querySelector('.compare__table');
    const usColumn = document.querySelector('.compare__cell--us');

    if (!scrollWrap || !table || !usColumn) return { error: 'elements not found' };

    const wrapRect = scrollWrap.getBoundingClientRect();
    const usRect = usColumn.getBoundingClientRect();

    return {
      scrollWrapWidth: wrapRect.width,
      tableMinWidth: window.getComputedStyle(table).minWidth,
      usColumnLeft: usRect.left,
      usColumnRight: usRect.right,
      usColumnWidth: usRect.width,
      isUsCellVisible: usRect.left < wrapRect.right && usRect.right > wrapRect.left,
      scrollLeft: scrollWrap.scrollLeft,
      scrollWidth: scrollWrap.scrollWidth,
      canScroll: scrollWrap.scrollWidth > scrollWrap.clientWidth,
    };
  });
  log(`Compare table info: ${JSON.stringify(tableInfo, null, 2)}`);

  // If it can scroll, check how far the Sidekick column is
  if (tableInfo.canScroll) {
    log(`BUG: Compare table requires horizontal scroll on mobile. Sidekick column is initially at x=${tableInfo.usColumnLeft}px, viewport is 375px wide`);
  }

  // ---- CHECK 4: Small text (below 12px) ----
  const smallTextElements = await page.evaluate(() => {
    const allText = document.querySelectorAll('p, li, span, div, h1, h2, h3, h4, h5, h6, button, a, label');
    const small = [];
    allText.forEach(el => {
      const style = window.getComputedStyle(el);
      const size = parseFloat(style.fontSize);
      const text = el.textContent.trim();
      if (size < 12 && text.length > 0 && text.length < 200) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          small.push({ tag: el.tagName, text: text.substring(0, 50), size, className: el.className });
        }
      }
    });
    return small;
  });
  if (smallTextElements.length > 0) {
    log(`BUG: ${smallTextElements.length} element(s) with text below 12px:`);
    smallTextElements.forEach(el => log(`  - ${el.tag}.${el.className}: "${el.text}" = ${el.size}px`));
  } else {
    log(`OK: No text below 12px detected`);
  }

  // ---- CHECK 5: Tap targets below 44px ----
  const smallTapTargets = await page.evaluate(() => {
    const interactive = document.querySelectorAll('button, a, [role="button"], input, select, textarea, .prompt-btn, .faq__q');
    const small = [];
    interactive.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && (rect.height < 44 || rect.width < 44)) {
        small.push({
          tag: el.tagName,
          text: el.textContent.trim().substring(0, 50),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          className: el.className,
        });
      }
    });
    return small;
  });
  if (smallTapTargets.length > 0) {
    log(`WARNING: ${smallTapTargets.length} tap target(s) below 44px:`);
    smallTapTargets.forEach(t => log(`  - ${t.tag}: "${t.text}" ${t.width}x${t.height}px`));
  } else {
    log(`OK: All tap targets meet 44px minimum`);
  }

  // ---- CHECK 6: Overlapping elements ----
  const overlapInfo = await page.evaluate(() => {
    // Check pricing toggle "Save 20%" relative position
    const toggle = document.querySelector('.pricing__toggle');
    const pill = document.querySelector('.pricing__toggle-save');
    if (!toggle || !pill) return 'elements not found';
    const toggleRect = toggle.getBoundingClientRect();
    const pillRect = pill.getBoundingClientRect();
    return {
      toggleWidth: toggleRect.width,
      pillLeft: pillRect.left,
      pillRight: pillRect.right,
      pillTop: pillRect.top,
      pillBottom: pillRect.bottom,
      toggleRight: toggleRect.right,
      overflowsViewport: pillRect.right > 375,
    };
  });
  log(`Pricing toggle layout: ${JSON.stringify(overlapInfo)}`);

  // ---- Section screenshots ----
  const sections = [
    { selector: '.hero', name: '02-hero' },
    { selector: '.demo', name: '03-demo' },
    { selector: '.how', name: '04-how' },
    { selector: '.features', name: '05-features' },
    { selector: '.compare', name: '06-compare' },
    { selector: '.pricing', name: '07-pricing' },
    { selector: '.proof', name: '08-proof' },
    { selector: '.faq', name: '09-faq' },
    { selector: '.final-cta', name: '10-final-cta' },
  ];

  for (const s of sections) {
    try {
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.scrollIntoView({ behavior: 'instant' });
      }, s.selector);
      await page.waitForTimeout(300);
      const el = await page.$(s.selector);
      if (el) {
        await el.screenshot({ path: `${SCREENSHOT_DIR}/${s.name}.png` });
        log(`Screenshot: ${s.name}.png`);
      }
    } catch (e) {
      log(`Error screenshotting ${s.name}: ${e.message}`);
    }
  }

  // ---- Check layout of pricing section at 375px ----
  const pricingLayout = await page.evaluate(() => {
    const grid = document.querySelector('.pricing__grid');
    const plans = document.querySelectorAll('.plan');
    if (!grid || !plans.length) return 'not found';
    const gridRect = grid.getBoundingClientRect();
    const planRects = Array.from(plans).map(p => {
      const r = p.getBoundingClientRect();
      return { width: Math.round(r.width), height: Math.round(r.height), left: Math.round(r.left) };
    });
    return { gridWidth: Math.round(gridRect.width), plans: planRects };
  });
  log(`Pricing layout at 375px: ${JSON.stringify(pricingLayout)}`);

  // Write results to file
  fs.writeFileSync('/tmp/marketing-app/qa-results.txt', results.join('\n'));

  await browser.close();
  console.log('\n=== QA COMPLETE ===');
  console.log(results.join('\n'));
})();
