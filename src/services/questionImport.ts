import mammoth from 'mammoth/mammoth.browser';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { OptionKey, Question } from '../types';

/**
 * Official supported upload format (shown to admin in the Question Bank tab):
 *
 *   1. What is the supreme law of Nigeria?
 *   A. Criminal Code Act
 *   B. Constitution of the Federal Republic of Nigeria
 *   C. Evidence Act
 *   D. Electoral Act
 *   Answer: B
 *   Explanation: Section 1(1) of the 1999 Constitution...
 *
 * The parser is forgiving and also accepts:
 * - "1)", "Q1:", "Question 1 -" style numbering
 * - options as "A)", "(A)", "a.", "A -"
 * - answers as "Ans: B", "Correct: B", "Correct Answer - B"
 * - correct option marked with a leading "*" e.g. "*B. Constitution..."
 * - "Explanation:" / "Reason:" / "Ref:" lines (optional)
 */

export const QUESTION_TEMPLATE = `MY-UNN QUIZ — QUESTION UPLOAD FORMAT
=====================================
Rules:
1. Number each question (1.  2.  3. ...). One question per block.
2. Give options A, B, C, D each on its own line.
3. Give the correct answer as "Answer: X" (A, B, C or D).
4. Optionally add "Explanation: ..." for study feedback.
5. Leave a blank line between questions.

Example (copy this style):

1. What is the supreme law of the Federal Republic of Nigeria?
A. Criminal Code Act
B. Constitution of the Federal Republic of Nigeria
C. Evidence Act
D. Electoral Act
Answer: B
Explanation: Section 1(1) of the 1999 Constitution makes it supreme.

2. Fundamental Human Rights are entrenched in which Chapter of the 1999 Constitution?
A. Chapter I
B. Chapter II
C. Chapter III
D. Chapter IV
Answer: D

3. Which section vests judicial powers of the Federation in the courts?
A. Section 4
B. Section 5
C. Section 6
D. Section 8
Answer: C
Explanation: Section 6 of the 1999 Constitution.
`;

export interface ParseReport {
  questions: Question[];
  skippedBlocks: number;
  warnings: string[];
}

const QUESTION_START =
  /^\s*(?:question\s*)?(?:Q\s*)?(\d{1,4})\s*[\).\:\-\s]+\s*\S/im;
const OPTION_LINE = /^\s*(\*?)\s*\(?([A-Da-d])\)?\s*[\).\:\-\s]+\s*(.+?)\s*$/;
const ANSWER_LINE =
  /^\s*(?:answer|ans|correct(?:\s+answer|\s+option)?|key)\s*[\:\-\=]\s*\(?([A-Da-d])\)?/i;
const ANSWER_INLINE = /(?:answer|ans|correct)\s*[\:\-\=]\s*\(?([A-Da-d])\)?/i;
const EXPLAIN_LINE =
  /^\s*(?:explanation|explain|reason|ref(?:erence)?|note)\s*[\:\-\=]\s*(.+?)\s*$/i;

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/** Rebuild readable lines from PDF text (pdf.js joins words with spaces). */
function reconstructPdfText(raw: string): string {
  let text = raw;
  // Put each option / answer / explanation marker on its own line.
  text = text.replace(/\s+([A-Da-d][\.\):]\s)/g, '\n$1');
  text = text.replace(
    /\s+((?:Answer|Ans|Correct Answer|Correct|Explanation|Reason|Ref)\s*[:\-])/gi,
    '\n$1'
  );
  // Put each numbered question on its own line.
  text = text.replace(/\s+((?:Question\s+)?\d{1,4}\s*[\.\)\:]\s)/g, '\n$1');
  // Collapse excessive spaces, keep newlines.
  text = text
    .split('\n')
    .map((l) => l.replace(/[ \t]{2,}/g, ' ').trim())
    .join('\n');
  return text.replace(/\n{3,}/g, '\n\n');
}

function splitIntoBlocks(normalized: string): string[] {
  const splitter =
    /(?=^\s*(?:question\s*)?(?:Q\s*)?\d{1,4}\s*[\).\:\-\s]+\s*\S)/gim;
  return normalized
    .split(splitter)
    .map((b) => b.trim())
    .filter(Boolean);
}

function parseBlock(block: string, index: number): Question | null {
  const lines = block
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 3) return null;

  let answer: OptionKey | undefined;
  let explanation = '';
  const questionLines: string[] = [];
  const options: Partial<Record<OptionKey, string>> = {};

  for (const line of lines) {
    const optMatch = line.match(OPTION_LINE);
    const ansMatch = line.match(ANSWER_LINE);
    const expMatch = line.match(EXPLAIN_LINE);

    if (ansMatch) {
      answer = ansMatch[1].toUpperCase() as OptionKey;
      continue;
    }
    if (expMatch) {
      explanation = expMatch[1].trim();
      continue;
    }
    if (optMatch && optMatch[3] && optMatch[3].length > 0) {
      const key = optMatch[2].toUpperCase() as OptionKey;
      const starred = optMatch[1] === '*';
      if (!options[key]) options[key] = optMatch[3].trim();
      if (starred && !answer) answer = key;
      continue;
    }
    // Inline answer at end of option/question line e.g. "D. Custom (Answer: D)"
    const inline = line.match(ANSWER_INLINE);
    if (inline && !ansMatch) {
      answer = inline[1].toUpperCase() as OptionKey;
      const cleaned = line.replace(ANSWER_INLINE, '').trim();
      if (/^[A-Da-d][\.\):\s]/.test(cleaned)) continue;
      if (cleaned) questionLines.push(cleaned);
      continue;
    }
    questionLines.push(line);
  }

  const questionText = questionLines
    .map((l) =>
      l
        .replace(/^\s*(?:question\s*)?(?:Q\s*)?\d{1,4}\s*[\).\:\-\s]*/i, '')
        .trim()
    )
    .filter(Boolean)
    .join(' ')
    .trim();

  if (!questionText || !options.A || !options.B) return null;

  return {
    id: `q_bank_${uid(String(index))}`,
    questionText,
    options: {
      A: options.A,
      B: options.B,
      C: options.C || 'None of the above',
      D: options.D || 'All of the above',
    },
    correctAnswer: answer || 'A',
    explanation: explanation || '',
  };
}

/** Parse raw text into questions with a detailed report. */
export function parseQuestionTextDetailed(text: string): ParseReport {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const warnings: string[] = [];
  if (!normalized) return { questions: [], skippedBlocks: 0, warnings };

  const blocks = QUESTION_START.test(normalized)
    ? splitIntoBlocks(normalized)
    : [normalized];
  const questions: Question[] = [];
  let skippedBlocks = 0;

  blocks.forEach((block, i) => {
    const q = parseBlock(block, i);
    if (q) questions.push(q);
    else {
      skippedBlocks += 1;
      if (warnings.length < 5) {
        const preview = block.slice(0, 80).replace(/\s+/g, ' ');
        warnings.push(`Block ${i + 1} skipped (needs question + options A–D): "${preview}…"`);
      }
    }
  });

  return { questions, skippedBlocks, warnings };
}

function parseQuestionText(text: string): Question[] {
  return parseQuestionTextDetailed(text).questions;
}

async function readPdf(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(line);
  }
  return reconstructPdfText(pages.join('\n'));
}

async function readWord(file: File): Promise<string> {
  const result = await mammoth.extractRawText({
    arrayBuffer: await file.arrayBuffer(),
  });
  // Mammoth keeps paragraphs; also handle tab-separated option rows.
  return result.value.replace(/[ \t]+\n/g, '\n');
}

export async function extractQuestionsFromFileDetailed(
  file: File
): Promise<ParseReport & { rawChars: number }> {
  const name = file.name.toLowerCase();
  let text: string;
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
    text = await readPdf(file);
  } else if (
    file.type.includes('word') ||
    file.type.includes('officedocument') ||
    name.endsWith('.docx') ||
    name.endsWith('.doc')
  ) {
    text = await readWord(file);
  } else {
    text = await file.text();
  }
  const report = parseQuestionTextDetailed(text);
  return { ...report, rawChars: text.length };
}

export async function extractQuestionsFromFile(file: File): Promise<Question[]> {
  const report = await extractQuestionsFromFileDetailed(file);
  return report.questions;
}

export function extractQuestionsFromText(text: string): Question[] {
  return parseQuestionText(text);
}

export function extractQuestionsFromTextDetailed(text: string): ParseReport {
  return parseQuestionTextDetailed(text);
}

/** Download a .txt template showing the exact upload format. */
export function downloadQuestionTemplate(): void {
  const blob = new Blob([QUESTION_TEMPLATE], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'UNN_Question_Upload_Template.txt';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
