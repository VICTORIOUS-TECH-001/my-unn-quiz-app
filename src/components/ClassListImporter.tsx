import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileUp,
  LoaderCircle,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { Student } from '../types';
import { cbtStorage } from '../services/storage';
import {
  downloadClassListTemplate,
  extractStudentsFromFile,
} from '../services/classListImport';

interface ClassListImporterProps {
  onClose: () => void;
  onImported: () => void;
}

/**
 * Upload the OFFICIAL CLASS LIST (PDF / Word / TXT / CSV). Every parsed
 * student is added to the roster + Firebase and can immediately log in —
 * each one gets their own dashboard.
 */
export const ClassListImporter: React.FC<ClassListImporterProps> = ({
  onClose,
  onImported,
}) => {
  const [defaults, setDefaults] = useState({
    level: '100 Level',
    faculty: 'Faculty of Law',
    campus: 'UNEC (Enugu Campus)',
    class: '100 Level Class',
  });
  const [parsed, setParsed] = useState<Student[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setIsReading(true);
    setStatus(null);
    setIsError(false);
    setWarnings([]);
    setParsed([]);
    try {
      const report = await extractStudentsFromFile(file, defaults);
      setFileName(file.name);
      setParsed(report.students);
      setSkipped(report.skippedLines);
      setWarnings(report.warnings);
      if (report.students.length === 0) {
        setIsError(true);
        setStatus(
          'No students found. Each line needs a name + reg number like "2025/298761". Text-based PDFs work best (not scanned images).'
        );
      } else {
        setStatus(
          `Found ${report.students.length} student${report.students.length === 1 ? '' : 's'} — review below, then confirm import.`
        );
      }
    } catch (error) {
      console.error('Class list import failed:', error);
      setIsError(true);
      setStatus('Could not read this file. Use a text-based PDF, DOCX, TXT or CSV.');
    } finally {
      setIsReading(false);
    }
  };

  const handleConfirm = async () => {
    if (parsed.length === 0) return;
    setIsSaving(true);
    setStatus('Importing students…');
    try {
      // Re-apply current defaults in case admin edited them after parsing
      const withDefaults = parsed.map((s) => ({ ...s, ...defaults }));
      const { added, updated } = cbtStorage.importStudents(withDefaults);
      setStatus(`✅ Imported ${added} new, updated ${updated} — ☁️ pushing roster to Firebase…`);
      try {
        await cbtStorage.pushStudentsToFirebase();
        setStatus(
          `✅ Done! ${added} new + ${updated} updated students. ☁️ Roster live in Firebase — every user can now log in to their dashboard.`
        );
      } catch {
        setStatus(
          `✅ Imported ${added} new + ${updated} updated on this device. ⚠️ Firebase push failed — use "Upload Class List" to retry.`,
          );
        setIsError(true);
      }
      onImported();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 border border-slate-200 max-h-[92vh] overflow-y-auto anim-pop">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-700" />
            Import Official Class List
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Upload the <strong>030 Official Class List</strong> (PDF, Word, TXT or CSV). Each row
          needs a student name + registration number (e.g. <code>2025/298761</code>). Matching
          reg numbers update existing records; new ones are added — and <strong>every user
          instantly gets their own dashboard</strong> on login.
        </p>

        {/* Defaults */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {(
            [
              ['level', 'Level'],
              ['class', 'Class'],
              ['faculty', 'Faculty'],
              ['campus', 'Campus'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="font-semibold text-slate-700 block mb-1">{label}</label>
              <input
                value={defaults[key]}
                onChange={(e) => setDefaults({ ...defaults, [key]: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>
          ))}
        </div>

        {/* Upload zone */}
        <div
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer rounded-2xl border-2 border-dashed border-emerald-300 bg-gradient-to-br from-emerald-50/80 to-lime-50/60 hover:border-emerald-500 p-5 text-center transition-all"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.csv"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.currentTarget.value = '';
            }}
          />
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-700 text-white flex items-center justify-center shadow-lg float-soft">
              {isReading ? (
                <LoaderCircle className="w-6 h-6 animate-spin" />
              ) : (
                <FileUp className="w-6 h-6" />
              )}
            </div>
          </div>
          <p className="mt-2 text-xs font-bold text-slate-900">
            {isReading ? 'Reading class list…' : fileName || 'Click to upload class list file'}
          </p>
          <p className="text-[11px] text-slate-500">.pdf, .docx, .txt, .csv</p>
          <div className="mt-2 flex justify-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-bold shadow">
              <Upload className="w-3.5 h-3.5" /> Choose file
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                downloadClassListTemplate();
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-900 text-xs font-bold hover:bg-emerald-50"
            >
              <Download className="w-3.5 h-3.5" /> CSV template
            </button>
          </div>
        </div>

        {status && (
          <div
            className={`flex items-start gap-2.5 p-3 rounded-xl text-xs border ${
              isError
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            {isError ? (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
            )}
            <span className="font-medium">{status}</span>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
            {warnings.map((w, i) => (
              <p key={i}>⚠️ {w}</p>
            ))}
            {skipped > warnings.length && <p>…and {skipped - warnings.length} more skipped lines.</p>}
          </div>
        )}

        {/* Preview */}
        {parsed.length > 0 && (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 text-slate-600">
                  <tr>
                    <th className="p-2 w-12 text-center">S/N</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Reg No</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsed.slice(0, 100).map((s) => (
                    <tr key={s.regNo}>
                      <td className="p-2 text-center font-mono text-slate-400">{s.sn}</td>
                      <td className="p-2 font-semibold text-slate-800">{s.name}</td>
                      <td className="p-2 font-mono text-emerald-800">{s.regNo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.length > 100 && (
              <p className="text-center text-[11px] text-slate-400 py-1.5 bg-slate-50">
                Showing first 100 of {parsed.length}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
          >
            Close
          </button>
          <button
            onClick={() => void handleConfirm()}
            disabled={parsed.length === 0 || isSaving || isReading}
            className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5"
          >
            {isSaving ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            Import {parsed.length > 0 ? `${parsed.length} students` : 'students'}
          </button>
        </div>
      </div>
    </div>
  );
};
