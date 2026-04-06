
import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';

// Simple CSV parser that handles quotes and newlines within fields
function parseCSV(csvText: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        if (char === '\r') i++;
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  const [headerRow, ...dataRows] = rows;
  if (!headerRow) return [];

  return dataRows.map(row => {
    const obj: Record<string, string> = {};
    headerRow.forEach((header, index) => {
      obj[header] = row[index] || '';
    });
    // Astro loaders expect an 'id' field if not provided by the loader
    if (!obj.id) {
        obj.id = obj.ID || obj.UUID || '';
    }
    return obj;
  });
}

const projects = defineCollection({
  loader: file('src/projects/www projects.csv', {
    parser: (text) => parseCSV(text),
  }),
  schema: z.object({
    id: z.string(),
    ID: z.string(),
    Name: z.string(),
    Summary: z.string().optional(),
    Description: z.string().optional(),
    Status: z.string(),
    Priority: z.string().optional().nullable(),
    "Updated At": z.string().optional(),
  }),
});

const issues = defineCollection({
  loader: file('src/issues/null-hype issues.csv', {
    parser: (text) => parseCSV(text),
  }),
  schema: z.object({
    id: z.string(),
    ID: z.string(),
    Title: z.string(),
    Description: z.string().optional(),
    Status: z.string(),
    Priority: z.string().or(z.number()).optional().nullable(),
    "Project ID": z.string().optional(),
    Project: z.string().optional(),
    Assignee: z.string().optional(),
    Updated: z.string().optional(),
    "Blocked by": z.string().optional(),
  }),
});

export const collections = { projects, issues };
