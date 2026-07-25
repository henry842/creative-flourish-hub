/**
 * Printable, branded reports.
 *
 * Opens a self-contained document and triggers the print dialog, so the user can save a
 * PDF with no extra dependency. All interpolated content is escaped: red flags, summaries
 * and titles come from model output and the database, and must never be treated as markup.
 */

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type ReportSection =
  | { type: "metrics"; title: string; rows: { label: string; value: string }[] }
  | { type: "list"; title: string; items: string[]; tone?: "danger" | "default"; empty?: string }
  | { type: "text"; title: string; body: string }
  | { type: "timeline"; title: string; items: { date: string; event: string }[] };

export interface ReportOptions {
  title: string;
  subtitle?: string;
  /** Big headline figure, e.g. the health score. */
  highlight?: { label: string; value: string; caption?: string };
  sections: ReportSection[];
}

const STYLES = `
  *{box-sizing:border-box}
  body{font-family:"Hanken Grotesk",-apple-system,Segoe UI,sans-serif;color:#1f1c2b;background:#fff;
       margin:0;padding:48px 56px;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  header{display:flex;align-items:center;justify-content:space-between;gap:16px;
         padding-bottom:18px;border-bottom:2px solid #2b2770;margin-bottom:28px}
  .brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:19px;color:#2b2770;letter-spacing:-.02em}
  .mark{width:26px;height:26px;border-radius:7px;background:#2b2770;position:relative;flex:none}
  .mark::after{content:"";position:absolute;inset:6px 6px auto auto;width:7px;height:7px;border-radius:50%;background:#d9622b}
  .meta{font-size:12px;color:#6b6779;text-align:right}
  h1{font-size:25px;margin:0 0 4px;letter-spacing:-.02em}
  .sub{color:#6b6779;font-size:14px;margin:0 0 26px}
  .highlight{display:flex;align-items:baseline;gap:14px;background:#f6f4ef;border:1px solid #e6e1d8;
             border-radius:12px;padding:18px 22px;margin-bottom:26px}
  .highlight .v{font-size:40px;font-weight:700;color:#2b2770;line-height:1;font-variant-numeric:tabular-nums}
  .highlight .l{font-size:13px;color:#6b6779;text-transform:uppercase;letter-spacing:.06em}
  .highlight .c{font-size:13px;color:#6b6779;margin-left:auto;max-width:52%;text-align:right}
  h2{font-size:14px;text-transform:uppercase;letter-spacing:.07em;color:#6b6779;
     margin:26px 0 10px;padding-bottom:6px;border-bottom:1px solid #e6e1d8}
  table{width:100%;border-collapse:collapse;font-size:14px}
  td{padding:7px 0;border-bottom:1px solid #f0ede7}
  td.v{text-align:right;font-weight:600;font-variant-numeric:tabular-nums}
  ul{margin:0;padding-left:18px;font-size:14px}
  li{margin:5px 0}
  li.danger{color:#a3311f}
  .text{font-size:14px;white-space:pre-wrap}
  .tl{font-size:14px;border-left:2px solid #e6e1d8;padding-left:14px;margin-left:4px}
  .tl div{margin:8px 0}
  .tl b{color:#2b2770;font-variant-numeric:tabular-nums}
  .empty{color:#8b8797;font-size:14px;font-style:italic}
  footer{margin-top:36px;padding-top:14px;border-top:1px solid #e6e1d8;font-size:11px;color:#8b8797}
  @page{margin:16mm}
  @media print{body{padding:0}h2{break-after:avoid}table,ul,.tl{break-inside:avoid}}
`;

function renderSection(s: ReportSection): string {
  const title = `<h2>${escapeHtml(s.title)}</h2>`;

  if (s.type === "metrics") {
    const rows = s.rows
      .map((r) => `<tr><td>${escapeHtml(r.label)}</td><td class="v">${escapeHtml(r.value)}</td></tr>`)
      .join("");
    return `${title}<table>${rows}</table>`;
  }

  if (s.type === "list") {
    if (!s.items.length) return `${title}<p class="empty">${escapeHtml(s.empty ?? "Nada a destacar.")}</p>`;
    const cls = s.tone === "danger" ? ' class="danger"' : "";
    return `${title}<ul>${s.items.map((i) => `<li${cls}>${escapeHtml(i)}</li>`).join("")}</ul>`;
  }

  if (s.type === "timeline") {
    if (!s.items.length) return `${title}<p class="empty">Sem eventos registrados.</p>`;
    const items = s.items
      .map((e) => `<div><b>${escapeHtml(e.date)}</b> — ${escapeHtml(e.event)}</div>`)
      .join("");
    return `${title}<div class="tl">${items}</div>`;
  }

  return `${title}<div class="text">${escapeHtml(s.body)}</div>`;
}

/** Builds the full report document. Exported separately so it can be unit-tested. */
export function buildReportHtml(opts: ReportOptions, now: Date = new Date()): string {
  const date = now.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${escapeHtml(opts.title)} — FinSight</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&display=swap">
<style>${STYLES}</style></head><body>
<header>
  <div class="brand"><span class="mark"></span>FinSight</div>
  <div class="meta">Relatório gerado em ${escapeHtml(date)}</div>
</header>
<h1>${escapeHtml(opts.title)}</h1>
${opts.subtitle ? `<p class="sub">${escapeHtml(opts.subtitle)}</p>` : ""}
${
  opts.highlight
    ? `<div class="highlight"><span class="v">${escapeHtml(opts.highlight.value)}</span>
       <span class="l">${escapeHtml(opts.highlight.label)}</span>
       ${opts.highlight.caption ? `<span class="c">${escapeHtml(opts.highlight.caption)}</span>` : ""}</div>`
    : ""
}
${opts.sections.map(renderSection).join("")}
<footer>
  FinSight — ferramenta de análise de documentos. Este relatório é derivado dos dados dos
  documentos enviados e não constitui recomendação de investimento.
</footer>
</body></html>`;
}

/** Opens the report in a new tab and triggers the print dialog (user saves as PDF). */
export function openPrintReport(opts: ReportOptions): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;

  win.document.write(buildReportHtml(opts));
  win.document.close();
  win.focus();
  // Give fonts a moment so the printed output matches the screen.
  setTimeout(() => win.print(), 600);
  return true;
}
