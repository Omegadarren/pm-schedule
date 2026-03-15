import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });

// Color palette
const C = {
  navy:        [15,  23,  42],   // #0f172a
  blue:        [37,  99,  235],  // #2563eb
  blueLight:   [59,  130, 246],  // #3b82f6
  sectionBg:   [30,  58,  138],  // #1e3a8a
  sectionText: [219, 234, 254],  // #dbeafe
  headerBg:    [37,  99,  235],  // #2563eb
  headerText:  [255, 255, 255],
  rowAlt:      [248, 250, 252],  // #f8fafc
  rowNorm:     [255, 255, 255],
  border:      [203, 213, 225],  // #cbd5e1
  text:        [15,  23,  42],
  muted:       [100, 116, 139],  // #64748b
  green:       [22,  163, 74],   // #16a34a
  amber:       [180, 83,  9],    // #b45309
  red:         [185, 28,  28],   // #b91c1c
  cardBg:      [241, 245, 249],  // #f1f5f9
};

function fmt(dateStr) {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'M/d/yy'); } catch { return dateStr; }
}

function statusLabel(s) {
  return { not_started: 'Not Started', in_progress: 'In Progress', complete: 'Complete', on_hold: 'On Hold', active: 'Active', archived: 'Archived' }[s] || (s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—');
}

function hex(rgb) { return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join(''); }

export function generateProjectReport(project, tasks) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

  const PW = doc.internal.pageSize.getWidth();   // 279.4
  const PH = doc.internal.pageSize.getHeight();  // 215.9
  const ML = 14, MR = 14;
  const CW = PW - ML - MR;                       // content width ~251

  // ── Banner ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, PW, 26, 'F');

  // Thin accent stripe
  doc.setFillColor(...C.blueLight);
  doc.rect(0, 26, PW, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(project.name || 'Untitled Project', ML, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.sectionText);
  doc.text('PROJECT SCHEDULE REPORT', ML, 20);

  // Report date top-right
  doc.setFontSize(8);
  doc.setTextColor(...C.sectionText);
  const reportDate = `Generated ${format(new Date(), 'MMMM d, yyyy  h:mm a')}`;
  doc.text(reportDate, PW - MR, 20, { align: 'right' });

  // ── Info row ─────────────────────────────────────────────────────────────────
  let y = 33;

  // Left: project meta
  const meta = [
    ['Status',      statusLabel(project.status)],
    ['Start Date',  fmt(project.start_date)],
    ['End Date',    fmt(project.end_date)],
    project.description ? ['Description', project.description] : null,
  ].filter(Boolean);

  // Right: summary stats
  const nonSection = tasks.filter((t) => t.wbs?.includes('.'));
  const sections   = tasks.filter((t) => t.wbs && !t.wbs.includes('.'));
  const totalCost  = nonSection.reduce((s, t) => s + (Number(t.cost) || 0), 0);
  const avgPct     = nonSection.length
    ? Math.round(nonSection.reduce((s, t) => s + (Number(t.percent_complete) || 0), 0) / nonSection.length)
    : 0;
  const completedCount = nonSection.filter((t) => t.status === 'complete').length;

  const stats = [
    { label: 'Total Tasks',    value: String(nonSection.length), color: C.blueLight },
    { label: 'Sections',       value: String(sections.length),   color: C.blue },
    { label: 'Completed',      value: String(completedCount),    color: C.green },
    { label: 'Avg % Complete', value: `${avgPct}%`,              color: avgPct >= 75 ? C.green : avgPct >= 40 ? C.amber : C.red },
    { label: 'Total Cost',     value: USD.format(totalCost),     color: C.navy },
  ];

  // Info card (left half)
  const cardW = CW * 0.40;
  doc.setFillColor(...C.cardBg);
  doc.roundedRect(ML, y, cardW, 22, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.muted);

  let infoY = y + 5;
  for (const [label, value] of meta.slice(0, 3)) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.muted);
    doc.text(label + ':', ML + 4, infoY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.text);
    doc.text(String(value), ML + 30, infoY);
    infoY += 5;
  }
  if (meta[3]) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.muted);
    doc.text('Description:', ML + 4, infoY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.text);
    const wrapped = doc.splitTextToSize(String(meta[3][1]), cardW - 36);
    doc.text(wrapped[0], ML + 30, infoY);
  }

  // Stat cards (right of info card, evenly spaced)
  const statStart = ML + cardW + 6;
  const statW = (CW - cardW - 6) / stats.length - 2;
  for (let i = 0; i < stats.length; i++) {
    const sx = statStart + i * (statW + 2);
    doc.setFillColor(...C.cardBg);
    doc.roundedRect(sx, y, statW, 22, 2, 2, 'F');
    // Colored top bar
    doc.setFillColor(...stats[i].color);
    doc.roundedRect(sx, y, statW, 3, 1, 1, 'F');
    doc.rect(sx, y + 1.5, statW, 1.5, 'F'); // square off bottom of top bar

    doc.setTextColor(...C.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(stats[i].label, sx + statW / 2, y + 8, { align: 'center' });

    doc.setTextColor(...stats[i].color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(stats[i].value, sx + statW / 2, y + 17, { align: 'center' });
  }

  y += 26;

  // ── Task table ──────────────────────────────────────────────────────────────
  const sorted = [...tasks].sort((a, b) => (a.row_order ?? 0) - (b.row_order ?? 0));

  const head = [['WBS', 'Task / Section', 'Start', 'End', 'Days', 'Status', '%', 'Cost (USD)', 'Assigned To']];

  const body = sorted.map((t) => {
    const isSec = !!(t.wbs && !t.wbs.includes('.'));
    if (isSec) {
      // Section row — span visually by repeating name, leave detail cols blank
      return [t.wbs || '', t.name || '', '', '', '', '', '', '', ''];
    }
    return [
      t.wbs || '',
      t.name || '',
      fmt(t.start_date),
      fmt(t.end_date),
      t.duration_days != null ? String(t.duration_days) : '—',
      statusLabel(t.status),
      t.percent_complete != null ? `${t.percent_complete}%` : '0%',
      t.cost ? USD.format(Number(t.cost)) : '—',
      t.assigned_to || '—',
    ];
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: ML, right: MR },
    tableWidth: CW,
    headStyles: {
      fillColor: C.headerBg,
      textColor: C.headerText,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
    },
    bodyStyles: {
      fontSize: 8,
      textColor: C.text,
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      lineColor: C.border,
      lineWidth: 0.2,
    },
    alternateRowStyles: { fillColor: C.rowAlt },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center', textColor: C.muted, fontSize: 7 },
      1: { cellWidth: 68, fontStyle: 'normal' },
      2: { cellWidth: 21, halign: 'center' },
      3: { cellWidth: 21, halign: 'center' },
      4: { cellWidth: 12, halign: 'center' },
      5: { cellWidth: 24, halign: 'center' },
      6: { cellWidth: 13, halign: 'center' },
      7: { cellWidth: 24, halign: 'right' },
      8: { cellWidth: 'auto', halign: 'left' },
    },
    // Style section rows differently
    didParseCell(data) {
      const rowIdx = data.row.index;
      if (data.section !== 'body') return;
      const task = sorted[rowIdx];
      if (task && task.wbs && !task.wbs.includes('.')) {
        // Section header row
        data.cell.styles.fillColor = C.sectionBg;
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 8.5;
      }
    },
    // Indent task names by WBS depth
    didDrawCell(data) {
      if (data.section !== 'body' || data.column.index !== 1) return;
      const rowIdx = data.row.index;
      const task = sorted[rowIdx];
      if (!task || !task.wbs?.includes('.')) return;
      const depth = (task.wbs.match(/\./g) || []).length;
      if (depth > 1) {
        // Draw a small left indent indicator
        const x = data.cell.x + 2 + (depth - 1) * 4;
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.5);
        doc.line(x - 2, data.cell.y + data.cell.height / 2, x, data.cell.y + data.cell.height / 2);
      }
    },
    showHead: 'everyPage',
    // Page footer
    didDrawPage(data) {
      const pageNum = doc.internal.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(...C.muted);
      doc.setFont('helvetica', 'normal');
      // Left: project name
      doc.text(project.name || '', ML, PH - 6);
      // Center: confidential
      doc.text('CONFIDENTIAL — For internal use only', PW / 2, PH - 6, { align: 'center' });
      // Right: page number
      doc.text(`Page ${data.pageNumber}`, PW - MR, PH - 6, { align: 'right' });
      // Footer line
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.line(ML, PH - 9, PW - MR, PH - 9);
    },
  });

  // Save
  const safeName = (project.name || 'project').replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  doc.save(`${safeName}_report_${dateStr}.pdf`);
}
