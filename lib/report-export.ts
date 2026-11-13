import { zipSync, strToU8 } from 'fflate';
import {
  formatPercent,
  reportTable,
  selectReportRows,
  type AnalyticsSnapshot,
  type ReportKind,
  type ReportTable,
  type Cell,
} from './analytics-model';
export function exportMetadata(
  data: AnalyticsSnapshot,
  kind: ReportKind,
  query: string,
  sort: string,
  direction: string,
) {
  return [
    ['Arvik Smart Reviews', reportTable(data, kind).title],
    ['Generated at (UTC)', data.generatedAt],
    ['Date range (UTC)', data.filters.from + ' to ' + data.filters.to],
    [
      'Business filter',
      data.options.businesses.find((b) => b.id === data.filters.businessId)?.name ||
        data.filters.businessId ||
        'All businesses',
    ],
    [
      'Stand filter',
      data.options.stands.find((s) => s.id === data.filters.standId)?.name ||
        data.filters.standId ||
        'All stands',
    ],
    ['Interval', data.filters.interval],
    ['Search', query || 'None'],
    ['Sort', sort + ' ' + direction],
    ['Scope', 'Activity is date/entity filtered. Inventory is platform-wide current records.'],
  ];
}
export function csvCell(value: Cell) {
  if (value === null) return 'N/A';
  let text = String(value);
  if (typeof value === 'string' && (/^[\s]*[=+@-]/.test(text) || /^[\t\r]/.test(text)))
    text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function reportCsv(
  data: AnalyticsSnapshot,
  kind: ReportKind,
  query: string,
  sort: string,
  direction: 'asc' | 'desc',
) {
  const table = reportTable(data, kind),
    rows = selectReportRows(table, query, sort, direction);
  const lines: Cell[][] = [
    ...exportMetadata(data, kind, query, sort, direction),
    [],
    table.columns.map((c) => c.label),
    ...rows.map((r) =>
      table.columns.map((c) =>
        c.percentage ? formatPercent(r[c.key] as number | null) : r[c.key],
      ),
    ),
    [],
    ...data.notes.map((n) => ['Definition', n]),
  ];
  return '\uFEFF' + lines.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
const xml = (value: Cell) =>
  String(value ?? 'N/A')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
function column(index: number) {
  let value = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    value = String.fromCharCode(65 + ((n - 1) % 26)) + value;
  return value;
}
function worksheet(metadata: string[][], table: ReportTable, rows: Record<string, Cell>[]) {
  const headerRow = metadata.length + 2;
  const widths = table.columns.map((c) =>
    c.key === 'note'
      ? 115
      : c.key === 'scope'
        ? 85
        : c.key === 'code'
          ? 36
          : c.key === 'name' || c.key === 'businessName'
            ? 32
            : 20,
  );
  const merges =
    metadata.length && table.columns.length > 2
      ? '<mergeCells count="' +
        metadata.length +
        '">' +
        metadata
          .map(
            (_, i) =>
              '<mergeCell ref="B' +
              (i + 1) +
              ':' +
              column(table.columns.length - 1) +
              (i + 1) +
              '"/>',
          )
          .join('') +
        '</mergeCells>'
      : '';
  const cell = (v: Cell, col: number, row: number, style = 0) =>
    typeof v === 'number'
      ? '<c r="' + column(col) + row + '" s="' + style + '"><v>' + v + '</v></c>'
      : '<c r="' +
        column(col) +
        row +
        '" t="inlineStr" s="' +
        style +
        '"><is><t xml:space="preserve">' +
        xml(v) +
        '</t></is></c>';
  let body = metadata
    .map(
      (r, i) =>
        '<row r="' +
        (i + 1) +
        '" ht="' +
        Math.max(
          30,
          Math.ceil(r[1].length / Math.max(12, widths.slice(1).reduce((a, b) => a + b, 0) - 2)) *
            14,
        ) +
        '" customHeight="1">' +
        r.map((v, c) => cell(v, c, i + 1, c === 0 ? 1 : 0)).join('') +
        '</row>',
    )
    .join('');
  body +=
    '<row r="' +
    headerRow +
    '" ht="28" customHeight="1">' +
    table.columns.map((c, i) => cell(c.label, i, headerRow, 2)).join('') +
    '</row>';
  body += rows
    .map(
      (r, i) =>
        '<row r="' +
        (headerRow + i + 1) +
        '" ht="' +
        Math.max(
          30,
          ...table.columns.map(
            (c, j) => Math.ceil(String(r[c.key] ?? '').length / Math.max(8, widths[j] - 2)) * 14,
          ),
        ) +
        '" customHeight="1">' +
        table.columns
          .map((c, j) => {
            const value = r[c.key];
            return cell(
              c.percentage && typeof value === 'number' ? value / 100 : value,
              j,
              headerRow + i + 1,
              c.percentage && typeof value === 'number' ? 3 : 0,
            );
          })
          .join('') +
        '</row>',
    )
    .join('');
  const last = headerRow + rows.length;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="' +
    headerRow +
    '" topLeftCell="A' +
    (headerRow + 1) +
    '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' +
    table.columns
      .map(
        (c, i) =>
          '<col min="' +
          (i + 1) +
          '" max="' +
          (i + 1) +
          '" width="' +
          widths[i] +
          '" customWidth="1"/>',
      )
      .join('') +
    '</cols><sheetData>' +
    body +
    '</sheetData><autoFilter ref="A' +
    headerRow +
    ':' +
    column(table.columns.length - 1) +
    Math.max(headerRow, last) +
    '"/>' +
    merges +
    '<printOptions horizontalCentered="1"/><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>'
  );
}
export function reportXlsx(
  data: AnalyticsSnapshot,
  kind: ReportKind,
  query: string,
  sort: string,
  direction: 'asc' | 'desc',
) {
  const table = reportTable(data, kind),
    summary = reportTable(data, 'overview'),
    meta = exportMetadata(data, kind, query, sort, direction);
  const definitions: ReportTable = {
    title: 'Definitions',
    columns: [{ key: 'note', label: 'Metric definitions and limitations' }],
    rows: data.notes.map((note) => ({ note })),
  };
  const files: Record<string, Uint8Array> = {};
  const add = (name: string, content: string) => (files[name] = strToU8(content));
  add(
    '[Content_Types].xml',
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      [1, 2, 3]
        .map(
          (i) =>
            '<Override PartName="/xl/worksheets/sheet' +
            i +
            '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
        )
        .join('') +
      '</Types>',
  );
  add(
    '_rels/.rels',
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  );
  add(
    'xl/workbook.xml',
    '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/><sheet name="Summary" sheetId="2" r:id="rId2"/><sheet name="Definitions" sheetId="3" r:id="rId3"/></sheets></workbook>',
  );
  add(
    'xl/_rels/workbook.xml.rels',
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      [1, 2, 3]
        .map(
          (i) =>
            '<Relationship Id="rId' +
            i +
            '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' +
            i +
            '.xml"/>',
        )
        .join('') +
      '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  );
  add(
    'xl/styles.xml',
    '<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/><color rgb="FF18283E"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF142940"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1"/></xf><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
  );
  add(
    'xl/worksheets/sheet1.xml',
    worksheet(meta, table, selectReportRows(table, query, sort, direction)),
  );
  add('xl/worksheets/sheet2.xml', worksheet(meta, summary, summary.rows));
  add('xl/worksheets/sheet3.xml', worksheet([], definitions, definitions.rows));
  return zipSync(files, { level: 6 });
}
