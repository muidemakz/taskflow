import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { gatesApi } from '../../api/endpoints';

const TEMPLATE = 'gate_name,order,description\nDiscovery,1,Initial research and scoping\n';

// Minimal RFC4180-ish CSV parser (quoted fields, escaped quotes) -- no
// dependency added for three columns. Rows are parsed client-side and sent
// to the backend as JSON, not as a multipart file upload: there is no
// existing file-upload path or CSV-parsing library anywhere in this stack,
// and this keeps the wire format consistent with every other endpoint.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') inQuotes = false;
      else field += char;
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field); field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const [header, ...body] = rows;
  const cols = header.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i] ?? ''])));
}

export default function GateImportPanel({ projectId, onImported }) {
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gate_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const rows = rowsToObjects(parseCsv(String(reader.result)));
      if (!rows.length) return toast.error('No rows found in that CSV');
      setImporting(true);
      try {
        const { data } = await gatesApi.bulkImport(projectId, rows);
        toast.success(data.summary);
        onImported?.();
      } catch (error) {
        const errors = error.response?.data?.errors;
        if (errors?.length) toast.error(errors.slice(0, 3).join('; ') + (errors.length > 3 ? '…' : ''));
        else toast.error('Could not import gates');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
      <button className="btn-ghost" onClick={downloadTemplate}>
        <Download size={14} /> Download template
      </button>
      <button className="btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={importing}>
        <Upload size={14} /> {importing ? 'Importing…' : 'Bulk import gates'}
      </button>
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
    </div>
  );
}
