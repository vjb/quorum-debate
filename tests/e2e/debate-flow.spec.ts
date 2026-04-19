import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Quorum Debate - E2E Flow', () => {
  // Use a longer timeout for real LLM streams
  test.setTimeout(120000);

  test('should configure debate, upload assets, and complete real-time stream', async ({ page }) => {
    // Collect console errors
    page.on('console', msg => {
      if (msg.type() === 'error') console.error(`BROWSER ERROR: ${msg.text()}`);
    });
    page.on('pageerror', err => {
      console.error(`PAGE ERROR: ${err.message}`);
    });

    // 1. Navigate to the main page
    await page.goto('/');
    await expect(page).toHaveTitle(/Quorum Debate/i);

    // 2. Global Configuration Test
    const globalTaskInput = page.getByPlaceholder(/Enter the global debate topic/i);
    await expect(globalTaskInput).toBeVisible();
    await globalTaskInput.fill('Review this proposed architecture for a real-time ride-sharing application.');

    // Upload Global Image
    const globalUploadInput = page.locator('input[type="file"]').first();
    const imagePath = path.resolve(process.cwd(), 'test-assets', 'Whiteboard_Sketch.png');
    await globalUploadInput.setInputFiles(imagePath);
    
    // Assert preview thumbnail or upload success indicator
    await expect(page.getByText('Whiteboard_Sketch.png')).toBeVisible();

    // 3. RAG Isolation Upload Test
    // Add agents if not already present
    const addAgentBtn = page.getByRole('button', { name: /Add Agent/i });
    if (await addAgentBtn.isVisible()) {
      await addAgentBtn.click();
      await addAgentBtn.click();
    }

    // Agent 1: Lead Architect
    const agent1Name = page.getByPlaceholder(/Agent Name/i).nth(0);
    const agent1Role = page.getByPlaceholder(/Agent Persona\/Role/i).nth(0);
    await agent1Name.fill('Lead Architect');
    await agent1Role.fill('Focuses on system scalability.');

    // Agent 2: Security Auditor with RAG
    const agent2Name = page.getByPlaceholder(/Agent Name/i).nth(1);
    const agent2Role = page.getByPlaceholder(/Agent Persona\/Role/i).nth(1);
    await agent2Name.fill('Security Auditor');
    await agent2Role.fill('Finds vulnerabilities.');

    const agent2UploadInput = page.locator('.agent-card').nth(1).locator('input[type="file"]');
    const pdfPath = path.resolve(process.cwd(), 'test-assets', 'OWASP_Top_10_Standards.pdf');
    if (await agent2UploadInput.count() > 0) {
      await agent2UploadInput.setInputFiles(pdfPath);
      await expect(page.locator('.agent-card').nth(1).getByText('OWASP_Top_10_Standards.pdf')).toBeVisible();
    }

    // 4. Live Streaming & UI Test
    const startDebateBtn = page.getByRole('button', { name: /Start Debate/i });
    await expect(startDebateBtn).toBeVisible();
    await startDebateBtn.click();

    // The UI should show the debate arena and hide/disable config
    await expect(page.locator('.debate-arena')).toBeVisible();

    // Wait for the first message to stream in from the real API
    const messageContainer = page.locator('.message-bubble').first();
    await expect(messageContainer).toBeVisible({ timeout: 60000 });

    // Assert progressive rendering (content length should increase)
    const initialText = await messageContainer.innerText();
    await page.waitForTimeout(2000);
    const textAfterWait = await messageContainer.innerText();
    expect(textAfterWait.length).toBeGreaterThan(initialText.length);

    // 5. Termination State Test
    // Wait until the debate concludes (isConcluded = true triggers the banner)
    const conclusionBanner = page.getByText(/Debate Concluded/i);
    await expect(conclusionBanner).toBeVisible({ timeout: 120000 });
  });
});
