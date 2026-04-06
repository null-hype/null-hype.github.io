import { test, expect } from '@playwright/test';

test('home page shows projects collection', async ({ page }) => {
  await page.goto('http://localhost:4321/');

  // Wait for the page to load
  await page.waitForSelector('.now-page');

  // Check if "Projects" section heading is visible
  const projectsHeading = page.getByRole('heading', { name: 'Projects' });
  await expect(projectsHeading).toBeVisible();

  // Check if "Australian MCP Field Notes" project is visible
  const projectTitle = page.getByText('Australian MCP Field Notes');
  await expect(projectTitle).toBeVisible();

  // Check if it has the correct reference format
  const projectRef = page.getByText(/Project: 2861f9cc-ab68-4f82-9645-860a135e73f6/);
  await expect(projectRef).toBeVisible();
});
