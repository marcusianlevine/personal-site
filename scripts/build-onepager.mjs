// Builds the "Fuck Dating Apps" field-note PDFs from scripts/one-pager/field-note.md
// (a mirror of the authoritative Notion page) and scripts/one-pager/template.html.
//
//   npm run build:onepager            -> public/fuck-dating-apps-one-pager.pdf (no webinar)
//                                        public/fuck-dating-apps-one-pager-webinar.pdf (with webinar box)
//   node scripts/build-onepager.mjs --html   also writes the intermediate HTML next to the PDFs (debug)
//
// Markdown conventions (see the Notion page header): "## " sections in document order. "Opening" renders as
// plain paragraphs under the title; "Stages" = figure title (###), lede, "Caption:" (the diagram itself is
// drawn here); a section whose name starts with "The ladder" = blue callout, "The freeze" = dark callout;
// "Rep log" or "Approach log" = a table with tall empty rows; any other "|" table = a plain grid; "- " lines = bullet list;
// "> " = pull quote; "Ready to actually meet someone? (webinar|no webinar)" = the CTA band, one per variant,
// with "- **Label**: url" link lines; "Sources" = fine print. Fonts load from Google Fonts (needs network).
import { chromium } from 'playwright';
import { readFile, writeFile, unlink, rename } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcMd = path.join(here, 'one-pager', 'field-note.md');
const srcTpl = path.join(here, 'one-pager', 'template.html');
const outDir = path.resolve(here, '..', 'public');
const writeHtml = process.argv.includes('--html');

const VARIANTS = [
	{ key: 'no webinar', file: 'fuck-dating-apps-one-pager.pdf' },
	{ key: 'webinar', file: 'fuck-dating-apps-one-pager-webinar.pdf' },
];

// ---------- tiny markdown ----------
// Notion escapes literal brackets/asterisks/underscores with a backslash; drop those first.
const esc = (s) => s.replace(/\\([\[\]*_~])/g, '$1').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inline(s) {
	s = esc(s);
	s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
	s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
	return s;
}
/** Split markdown into { title, tagline, sections: [{ name, blocks }] } where blocks are
 *  { type: 'p'|'quote'|'h3'|'table'|'list', text|rows|items }. */
function parse(md) {
	const lines = md.replace(/\r\n/g, '\n').split('\n');
	const doc = { title: '', tagline: '', sections: [] };
	let cur = null;
	let para = [];
	const flush = () => {
		if (para.length && cur) cur.blocks.push({ type: 'p', text: para.join(' ') });
		para = [];
	};
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.startsWith('# ')) { doc.title = line.slice(2).trim(); continue; }
		if (/^Tagline:/i.test(line)) { doc.tagline = line.replace(/^Tagline:\s*/i, '').trim(); continue; }
		if (line.startsWith('## ')) { flush(); cur = { name: line.slice(3).trim(), blocks: [] }; doc.sections.push(cur); continue; }
		if (!cur) continue;
		if (line.startsWith('### ')) { flush(); cur.blocks.push({ type: 'h3', text: line.slice(4).trim() }); continue; }
		if (line.startsWith('> ')) { flush(); cur.blocks.push({ type: 'quote', text: line.slice(2).trim() }); continue; }
		if (line.startsWith('|')) {
			flush();
			const rows = [];
			while (i < lines.length && lines[i].startsWith('|')) {
				const cells = lines[i].slice(1, -1).split('|').map((c) => c.trim());
				if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
				i++;
			}
			i--;
			cur.blocks.push({ type: 'table', rows: rows.slice(1), header: rows[0] });
			continue;
		}
		if (/^[ \t]+- /.test(line)) {
			// Indented bullet: a sub-item of the previous top-level item.
			const last = cur.blocks[cur.blocks.length - 1];
			if (last && last.type === 'list' && last.items.length) {
				const parent = last.items[last.items.length - 1];
				const obj = typeof parent === 'string' ? { text: parent, sub: [] } : parent;
				obj.sub.push(line.trim().slice(2).trim());
				last.items[last.items.length - 1] = obj;
				continue;
			}
		}
		if (line.startsWith('- ')) {
			flush();
			const last = cur.blocks[cur.blocks.length - 1];
			const item = line.slice(2).trim();
			if (last && last.type === 'list') last.items.push(item);
			else cur.blocks.push({ type: 'list', items: [item] });
			continue;
		}
		if (line.trim() === '') { flush(); continue; }
		para.push(line.trim());
	}
	flush();
	return doc;
}

// ---------- render ----------
function table(b, cls) {
	const th = b.header.map((c) => `<th>${inline(c)}</th>`).join('');
	const rows = b.rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('\n');
	return `<table class="grid${cls ? ` ${cls}` : ''}"><thead><tr>${th}</tr></thead><tbody>
${rows}
</tbody></table>`;
}
const li = (i) =>
	typeof i === 'string'
		? `	<li>${inline(i)}</li>`
		: `	<li>${inline(i.text)}<ul>${i.sub.map((s) => `<li>${inline(s)}</li>`).join('')}</ul></li>`;
const blocks = (list, opts = {}) =>
	list
		.map((b) => {
			if (b.type === 'p') return `<p>${inline(b.text)}</p>`;
			if (b.type === 'quote') return `<p class="pull">${inline(b.text)}</p>`;
			if (b.type === 'list') return `<ul>
${b.items.map(li).join('\n')}
</ul>`;
			if (b.type === 'table') return table(b, opts.tableClass);
			if (b.type === 'h3') return `<h3>${inline(b.text)}</h3>`;
			return '';
		})
		.join('\n');

function render(doc, variant, tpl) {
	const get = (name) => doc.sections.find((s) => s.name === name);
	const need = (name) => {
		const s = get(name);
		if (!s) throw new Error(`Missing section "## ${name}" in field-note.md`);
		return s;
	};

	const stages = need('Stages');
	const stagesTitle = stages.blocks.find((b) => b.type === 'h3')?.text ?? '';
	const stagesParas = stages.blocks.filter((b) => b.type === 'p').map((b) => b.text);
	const stagesCaption = stagesParas.find((t) => /^Caption:/i.test(t))?.replace(/^Caption:\s*/i, '') ?? '';
	const stagesLede = stagesParas.find((t) => !/^Caption:/i.test(t)) ?? '';

	const special = new Set(['Opening', 'Stages', 'Sources']);
	const isCta = (n) => /^Ready to actually meet someone\?/i.test(n);
	const isDark = (n) => /^The freeze/i.test(n);
	const isBlue = (n) => /^The ladder/i.test(n);
	const isLog = (n) => /^(Rep|Approach) log/i.test(n);

	const sectionsHtml = doc.sections
		.filter((s) => !special.has(s.name) && !isCta(s.name))
		.map((s) => {
			if (isDark(s.name)) return `<div class="opinion">
	<h3>${inline(s.name)}</h3>
${blocks(s.blocks)}
</div>`;
			if (isBlue(s.name)) return `<div class="callout">
	<h3>${inline(s.name)}</h3>
${blocks(s.blocks)}
</div>`;
			if (isLog(s.name)) return `<h2>${inline(s.name)}</h2>
${blocks(s.blocks, { tableClass: 'log' })}`;
			return `<h2>${inline(s.name)}</h2>
${blocks(s.blocks)}`;
		})
		.join('\n\n');

	const cta = doc.sections.find((s) => isCta(s.name) && s.name.toLowerCase().includes(`(${variant.key})`));
	if (!cta) throw new Error(`Missing CTA section for variant "${variant.key}"`);
	const ctaTitle = cta.name.replace(/\s*\((webinar|no webinar)\)\s*$/i, '');
	const ctaLinks = (cta.blocks.find((b) => b.type === 'list')?.items ?? [])
		.map((it) => {
			const m = it.match(/^\*\*(.+?)\*\*:\s*(\S+)$/);
			if (!m) throw new Error(`CTA link line must look like "- **Label**: url", got: ${it}`);
			const [, label, url] = m;
			return `		<div class="link"><b>${esc(label)}</b><span><a href="${url}">${esc(url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a></span></div>`;
		})
		.join('\n');

	// Optional fine print at the very bottom.
	const sources = (get('Sources')?.blocks ?? []).filter((b) => b.type === 'p').map((b) => inline(b.text)).join(' ');

	return tpl
		.replace('{{title}}', esc(doc.title))
		.replace('{{tagline}}', esc(doc.tagline))
		.replace('{{opening}}', blocks(need('Opening').blocks))
		.replace('{{stages_title}}', inline(stagesTitle))
		.replace('{{stages_lede}}', inline(stagesLede))
		.replace('{{stages_caption}}', inline(stagesCaption))
		.replace('{{sections}}', sectionsHtml)
		.replace('{{cta_title}}', inline(ctaTitle))
		.replace('{{cta_body}}', blocks(cta.blocks.filter((b) => b.type !== 'list')))
		.replace('{{cta_links}}', ctaLinks)
		.replace('{{sources}}', sources);
}

// ---------- main ----------
const footer = `
	<div style="width:100%;font-family:'Work Sans',system-ui,sans-serif;font-size:7.5pt;color:#8A857A;
	            padding:0 13mm;display:flex;justify-content:space-between;">
		<span>A free field note by Marcus Levine, coach &amp; bodyworker · marcuslevine.com</span>
		<span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
	</div>`;

const doc = parse(await readFile(srcMd, 'utf8'));
const tpl = await readFile(srcTpl, 'utf8');
const failed = [];
const browser = await chromium.launch();
try {
	for (const variant of VARIANTS) {
		const html = render(doc, variant, tpl);
		const htmlPath = path.join(outDir, variant.file.replace(/\.pdf$/, '.html'));
		// Write to a temp HTML so relative font/asset loading behaves like a real page.
		await writeFile(htmlPath, html);
		const page = await browser.newPage();
		await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
		await page.evaluate(() => document.fonts.ready);
		const out = path.join(outDir, variant.file);
		const tmp = out + '.tmp';
		await page.pdf({
			path: tmp,
			format: 'A4',
			printBackground: true,
			preferCSSPageSize: true,
			displayHeaderFooter: true,
			headerTemplate: '<span></span>',
			footerTemplate: footer,
			margin: { top: '12mm', right: '13mm', bottom: '15mm', left: '13mm' },
		});
		await page.close();
		if (!writeHtml) await unlink(htmlPath);
		try {
			await rename(tmp, out);
			console.log(`wrote ${out}`);
		} catch (err) {
			// Windows locks a PDF that's open in a viewer. Leave the fresh render next to it.
			if (err.code === 'EBUSY' || err.code === 'EPERM') {
				failed.push(variant.file);
				console.error(`LOCKED: ${out} is open in another program. Fresh render left at ${tmp}. Close it and rerun.`);
			} else throw err;
		}
	}
} finally {
	await browser.close();
}
if (failed.length) process.exit(1);
