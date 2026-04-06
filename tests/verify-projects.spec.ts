import { test, expect } from '@playwright/test';

test('home page shows projects collection', async ({ page }) => {
  await page.goto('http://localhost:4321/');

  // Wait for the page to load
  await page.waitForSelector('.now-page');

  // Check if "Projects" section heading is visible
  const projectsHeading = page.getByRole('heading', { name: 'Projects' });
  await expect(projectsHeading).toBeVisible();

  // Check that other sections are NOT visible
  await expect(page.getByRole('heading', { name: 'Now' })).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recently done' })).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Not now' })).not.toBeVisible();

  // Check that header elements are NOT visible
  await expect(page.getByRole('link', { name: 'jungle.roaring.wave' })).not.toBeVisible();
  await expect(page.getByRole('link', { name: 'Dossier' })).not.toBeVisible();

  // Check that all 4 "In Progress" projects from the CSV are visible
  const projectItems = page.locator('.tidelane-list__item');
  await expect(projectItems).toHaveCount(4);

  // Check if "Australian MCP Field Notes" project is visible
  const projectTitle = page.getByText('Australian MCP Field Notes');
  await expect(projectTitle).toBeVisible();

  // Verify that it is a link and goes to a project page
  const projectLink = page.getByRole('link', { name: 'Australian MCP Field Notes' });
  await expect(projectLink).toBeVisible();
  const href = await projectLink.getAttribute('href');
  expect(href).toMatch(/\/projects\/.+/);

  // Check if it has the correct reference format
  const projectRef = page.getByText(/Project: 2861f9cc-ab68-4f82-9645-860a135e73f6/);
  await expect(projectRef).toBeVisible();

  // Navigate to the project page
  await projectLink.click();
  await page.waitForURL(/\/projects\/.+/);

  // Check if Latest Update is rendered on the project page
  const latestUpdateHeading = page.getByRole('heading', { name: /Latest Update/i });
  await expect(latestUpdateHeading).toBeVisible();
});
