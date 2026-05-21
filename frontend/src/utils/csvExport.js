/**
 * Client-side CSV download — Excel-friendly (BOM + sep= + quoted fields).
 */
function escapeCsvCell(cell) {
  if (cell === null || cell === undefined) return '';
  const s = String(cell);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadCsv(filename, rows) {
  const lines = rows.map((row) => row.map(escapeCsvCell).join(','));
  const csv = `\uFEFFsep=,\n${lines.join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
