import { readFile } from 'node:fs/promises';

import { defineCollection, z } from 'astro:content';

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
    return obj;
  });
}

async function readCollectionFromCsv(filePath: string) {
	return parseCSV(await readFile(filePath, 'utf8'));
}

function toSlug(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function withDefaultIds(entries: Record<string, string>[]) {
  return entries.map((entry) => ({
    ...entry,
    id: entry.id || entry.ID || entry.UUID || '',
  }));
}

function withProjectSlugs(entries: Record<string, string>[]) {
  const usedSlugs = new Set<string>();

  return entries.map((entry, index) => {
    const fallbackId = entry.ID || entry.UUID || `project-${index + 1}`;
    const baseSlug = toSlug(entry.Name || '') || toSlug(fallbackId) || `project-${index + 1}`;
    let slug = baseSlug;

    if (usedSlugs.has(slug)) {
      const suffix = toSlug(fallbackId.slice(0, 8)) || String(index + 1);
      slug = `${baseSlug}-${suffix}`;
      let duplicateIndex = 2;

      while (usedSlugs.has(slug)) {
        slug = `${baseSlug}-${suffix}-${duplicateIndex}`;
        duplicateIndex += 1;
      }
    }

    usedSlugs.add(slug);

    return {
      ...entry,
      id: slug,
    };
  });
}

async function loadProjectsCollection() {
	return withProjectSlugs(await readCollectionFromCsv('src/projects/www projects.csv'));
}

async function loadIssuesCollection() {
	return withDefaultIds(await readCollectionFromCsv('src/issues/null-hype issues.csv'));
}

const projects = defineCollection({
  loader: loadProjectsCollection,
  schema: z.object({
    id: z.string(),
    ID: z.string(),
    Name: z.string(),
    Summary: z.string().optional(),
    Description: z.string().optional(),
    Status: z.string(),
    Health: z.string().optional(),
    Priority: z.string().optional().nullable(),
    Initiatives: z.string().optional(),
    "Updated At": z.string().optional(),
    "Latest Update": z.string().optional(),
    "Latest Update Date": z.string().optional(),
  }),
});

const issues = defineCollection({
  loader: loadIssuesCollection,
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
