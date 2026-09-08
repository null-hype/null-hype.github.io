import { test, expect } from '@playwright/test';

test('investigate real exported evidence inside the embedded MCP Inspector', async ({ page }) => {
 await page.addInitScript(() => localStorage.setItem('MCP_USE_ANONYMIZED_TELEMETRY','false'));
 await page.goto('/part-1/chapter-1/lesson-4/');
 const preview = page.frameLocator('iframe[title="Embedded retrospective MCP Inspector"]');
 await preview.getByTestId('tool-item-inspectSnapshotPair').click();
 await preview.getByRole('combobox',{name:'pair *',exact:true}).click();
 await preview.getByRole('option').first().click();
 await preview.getByRole('combobox',{name:'category *',exact:true}).click();
 await preview.getByRole('option',{name:'all',exact:true}).click();
 await preview.getByTestId('tool-execution-execute-button').click();
 await expect(preview.getByText(/"returnedChanges":/)).toBeVisible();
 await expect(preview.getByText(/"limitations":/)).toBeVisible();
 await preview.getByRole('combobox',{name:'category *',exact:true}).click();
 await preview.getByRole('option',{name:'session',exact:true}).click();
 await preview.getByTestId('tool-execution-execute-button').click();
 await expect(preview.getByText(/"category": "session"/)).toBeVisible();
 await expect(page.getByText(/Pkl-derived editor hints are the next integration/)).toBeVisible();
});
