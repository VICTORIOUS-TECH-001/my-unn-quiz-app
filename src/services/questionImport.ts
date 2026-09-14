import mammoth from 'mammoth/mammoth.browser';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { OptionKey, Question } from '../types';

function parseQuestionText(text: string): Question[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const chunks = normalized.split(/(?=^\s*(?:Question\s*)?\d+[\).:\s])/im).filter(Boolean);

  return chunks
    .map((chunk, index): Question | null => {
      const lines = chunk.split('\n').map((line) => line.trim()).filter(Boolean);
      const questionText = lines
        .filter((line) => !/^[A-D][\).:\s]/i.test(line) && !/^(?:answer|correct answer)\s*:/i.test(line))
        .map((line) => line.replace(/^(?:Question\s*)?\d+[\).:\s]*/i, '').trim())
        .find(Boolean);
      const optionLines = lines.filter((line) => /^[A-D][\).:\s]/i.test(line));
      const options = Object.fromEntries(
        optionLines.map((line) => [line[0].toUpperCase(), line.replace(/^[A-D][\).:\s]*/i, '').trim()])
      ) as Question['options'];
      const answerLine = lines.find((line) => /^(?:answer|correct answer)\s*:/i.test(line));
      const answer = answerLine?.match(/[A-D]/i)?.[0].toUpperCase() as OptionKey | undefined;

      if (!questionText || !options.A || !options.B) return null;
      return {
        id: `q_import_${Date.now()}_${index}`,
        questionText,
        options: {
          A: options.A,
          B: options.B,
          C: options.C || 'None of the above',
          D: options.D || 'All of the above',
        },
        correctAnswer: answer || 'A',
        explanation: '',
      };
    })
    .filter((question): question is Question => Boolean(question));
}

async function readPdf(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  return pages.join('\n');
}

export async function extractQuestionsFromFile(file: File): Promise<Question[]> {
  let text: string;
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    text = await readPdf(file);
  } else if (
    file.type.includes('word') ||
    file.name.toLowerCase().endsWith('.docx') ||
    file.name.toLowerCase().endsWith('.doc')
  ) {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = result.value;
  } else {
    text = await file.text();
  }
  return parseQuestionText(text);
}

export function extractQuestionsFromText(text: string): Question[] {
  return parseQuestionText(text);
}
