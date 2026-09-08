import { test, expect } from '@playwright/test';

// Requires gap-runtime and its local Inspector (see gap-runtime/README.md). No route
// mocks: this exercises the compiled Pkl policy and Dagger decision path.
test('policy binds a session and only accepted proposals change its glossary', async ({ page, request }) => {
  const endpoint = process.env.GAP_TEST_RUNTIME_URL || 'http://localhost:8787';
  const response = await request.get(`${endpoint}/policies`);
  expect(response.ok()).toBeTruthy();
  const { policies } = await response.json();
  const unadmitted = policies.find((policy: { id: string }) => policy.id === 'unadmitted');
  const admitted = policies.find((policy: { id: string }) => policy.id === 'admitted');
  expect(unadmitted).toBeTruthy();
  expect(admitted).toBeTruthy();

  await page.goto('/part-1/chapter-1/lesson-3/');
  const exercise = page.getByRole('region', { name: 'Executable loanword exercise' });
  await exercise.getByRole('textbox', { name: 'Runtime address' }).fill(endpoint);
  await exercise.getByRole('button', { name: 'Connect', exact: true }).click();
  await exercise.getByLabel('Authored policy').selectOption(unadmitted.id);
  await exercise.getByRole('button', { name: 'Start session', exact: true }).click();
  const glossary = exercise.getByRole('region', { name: 'Session glossary' });
  const status = exercise.getByRole('status');
  await exercise.getByRole('button', { name: 'Submit loanword', exact: true }).click();
  await expect(status).toContainText('Rejected:');
  await expect(glossary).toContainText('No words added.');
  await exercise.getByRole('textbox', { name: 'Your proposal' }).fill('Schadenfreude');
  await exercise.getByRole('button', { name: 'Submit loanword', exact: true }).click();
  await expect(status).toContainText('Rejected:');
  await expect(glossary).toContainText('No words added.');

  // Merely changing the selector does not grant the existing session a new policy.
  await exercise.getByLabel('Authored policy').selectOption(admitted.id);
  await exercise.getByRole('button', { name: 'Submit loanword', exact: true }).click();
  await expect(status).toContainText('Rejected:');
  await expect(glossary).toContainText('No words added.');
  await exercise.getByRole('button', { name: 'Start a fresh session', exact: true }).click();
  await expect(glossary).toContainText('No words added.');
  await exercise.getByRole('button', { name: 'Submit loanword', exact: true }).click();
  await expect(status).toContainText('Accepted:');
  await expect(glossary.getByRole('listitem')).toHaveCount(1);
  await expect(glossary).toContainText('Schadenfreude');

  await exercise.getByRole('textbox', { name: 'Your proposal' }).fill('malicious joy');
  await exercise.getByRole('button', { name: 'Submit loanword', exact: true }).click();
  await expect(status).toContainText('Rejected:');
  await expect(glossary.getByRole('listitem')).toHaveCount(1);
  await expect(exercise.getByRole('region', { name: 'Execution record' })).toContainText('2 recorded calls');
  await exercise.getByText('Inspect Pkl and compiled JSON', { exact: true }).click();
  await expect(exercise.getByRole('heading', { name: 'Pkl source' })).toBeVisible();
  await expect(exercise.getByRole('heading', { name: 'Compiled JSON' })).toBeVisible();
  await exercise.getByText('Use the same session in MCP Inspector', { exact: true }).click();
  await expect(exercise.getByRole('link', { name: 'Open MCP Inspector' })).toHaveAttribute('href', /^http/);
  const inspector = await page.context().newPage();
  await inspector.addInitScript(() => localStorage.setItem('MCP_USE_ANONYMIZED_TELEMETRY', 'false'));
  await inspector.goto((await exercise.getByRole('link', { name: 'Open MCP Inspector' }).getAttribute('href'))!);
  await inspector.getByTestId('tool-item-submitLoanword').click();
  await inspector.getByTestId('tool-param-translation').fill('Schadenfreude');
  await inspector.getByTestId('tool-execution-execute-button').click();
  await expect(status).toContainText('Accepted:');
  await expect(glossary.getByRole('listitem')).toHaveCount(1);
  await expect(exercise.getByRole('region', { name: 'Execution record' })).toContainText('3 recorded calls');
  await inspector.getByTestId('tool-param-translation').fill('malicious joy');
  await inspector.getByTestId('tool-execution-execute-button').click();
  await expect(exercise.getByRole('region', { name: 'Execution record' })).toContainText('4 recorded calls');
  await expect(status).toContainText('Rejected:');
  await expect(glossary.getByRole('listitem')).toHaveCount(1);
});
