import mammoth from 'mammoth/mammoth.browser';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { Student } from '../types';

/**
 * Official class-list importer. Admin uploads the class list as PDF / Word /
 * TXT / CSV and every parsed student can immediately log in (reg number)
 * and gets their own dashboard.
 *
 * Accepted row styles (one student per line):
 *   1.  Abafor Chinaza Happiness   2025/298761
 *   2 | Abonyi Ezinne Princess | 2024/283415
 *   Adah Favour Sunday, 2025/296490
 */

export interface ClassListReport {
  students: Student[];
  skippedLines: number;
  warnings: string[];
}

const REG_RE = /\b(20\d{2})\s*\/\s*([A-Z0-9][A-Z0-9-]{2,})\b/i;
const HEADER_RE = /(s\s*\/\s*n|serial|full\s*name|registration|reg\.?\s*no)/i;

function titleCaseIfShouty(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 0 && letters === letters.toUpperCase()) {
    return name
      .toLowerCase()
      .replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
  }
  return name;
}

function cleanName(raw: string): string {
  let name = raw
    .replace(/^\s*\d{1,4}\s*[\).\|\-:;]\s*/, '') // leading serial
    .replace(/[\|\t;]+/g, ' ') // table separators
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\-–—.:,\s]+|[\-–—.:,\s]+$/g, '')
    .trim();
  name = titleCaseIfShouty(name);
  return name;
}

function parseLine(
  line: string,
  sn: number,
  defaults: { level: string; faculty: string; campus: string; class: string }
): Student | null {
  if (!line || line.trim().length < 4) return null;
  if (HEADER_RE.test(line) && !REG_RE.test(line)) return null;
  const match = line.match(REG_RE);
  if (!match) return null;
  const regNo = `${match[1]}/${match[2].replace(/-/g, '').toUpperCase()}`;
  let remainder = line.replace(match[0], ' ');
  // CSV style: pick the longest non-reg cell as the name
  if (remainder.includes(',')) {
    const cells = remainder
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c && !REG_RE.test(c) && !/^\d{1,4}$/.test(c));
    remainder = cells.sort((a, b) => b.length - a.length)[0] || remainder;
  }
  const name = cleanName(remainder);
  if (name.replace(/[^a-zA-Z]/g, '').length < 3) return null;
  if (HEADER_RE.test(name)) return null;
  return {
    sn,
    name,
    regNo,
    level: defaults.level,
    faculty: defaults.faculty,
    campus: defaults.campus,
    class: defaults.class,
  };
}

export function parseClassListText(
  text: string,
  defaults: { level: string; faculty: string; campus: string; class: string }
): ClassListReport {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const students: Student[] = [];
  const seen = new Set<string>();
  let skippedLines = 0;
  const warnings: string[] = [];
  let sn = 1;
  for (const line of lines) {
    const student = parseLine(line, sn, defaults);
    if (!student) {
      // Only count lines that looked like they wanted to be data rows
      if (line.length > 8 && !HEADER_RE.test(line)) {
        skippedLines += 1;
        if (warnings.length < 5) {
          warnings.push(`Skipped (no reg number found): "${line.slice(0, 70)}…"`);
        }
      }
      continue;
    }
    const key = student.regNo.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    student.sn = sn;
    sn += 1;
    students.push(student);
  }
  return { students, skippedLines, warnings };
}

async function readPdfText(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const lines: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    // Group text items into visual lines using their Y position so table
    // rows stay on one line (S/N | Name | RegNo).
    const rows = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue;
      const anyItem = item as unknown as { transform?: number[] };
      const y = anyItem.transform ? Math.round(anyItem.transform[5] / 4) : 0;
      const x = anyItem.transform ? anyItem.transform[4] : 0;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x, str: String(item.str) });
    }
    const sortedY = [...rows.keys()].sort((a, b) => b - a);
    for (const y of sortedY) {
      const row = rows
        .get(y)!
        .sort((a, b) => a.x - b.x)
        .map((c) => c.str)
        .join(' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (row) lines.push(row);
    }
  }
  return lines.join('\n');
}

export async function extractStudentsFromFile(
  file: File,
  defaults: { level: string; faculty: string; campus: string; class: string }
): Promise<ClassListReport> {
  const name = file.name.toLowerCase();
  let text: string;
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
    text = await readPdfText(file);
  } else if (
    file.type.includes('word') ||
    file.type.includes('officedocument') ||
    name.endsWith('.docx') ||
    name.endsWith('.doc')
  ) {
    const result = await mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer(),
    });
    text = result.value;
  } else {
    text = await file.text();
  }
  return parseClassListText(text, defaults);
}

export const CLASS_LIST_TEMPLATE = `S/N, FULL NAME, REGISTRATION NUMBER
1, Abafor Chinaza Happiness, 2025/298761
2, Abonyi Ezinne Princess, 2024/283415
3, Adah Favour Sunday, 2025/296490
`;

export function downloadClassListTemplate(): void {
  const blob = new Blob([CLASS_LIST_TEMPLATE], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'UNN_Class_List_Template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
