# Initialize-Playwright.ps1
# Automates Playwright setup for a new repository, optimized for VS Code with Agents.
# Run from the root of the new repo.
# Requires Node.js and npm installed.
# Usage: .\Initialize-Playwright.ps1 [-LLM <Claude|Grok|Other>]

param([string]$LLM)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step([string]$n, [string]$message) {
    Write-Host "`nStep $n`: $message" -ForegroundColor Cyan
}
function Write-Done([string]$message) {
    Write-Host "  + $message" -ForegroundColor Green
}
function Write-Skip([string]$message) {
    Write-Host "  ~ $message (skipped)" -ForegroundColor Yellow
}

# ── Step 1: Check for VS Code and install Playwright extension ────────────────
Write-Step 1 "Checking for VS Code..."
try {
    $null = code --version
    Write-Step 1 "Installing Playwright VS Code extension..."
    code --install-extension ms-playwright.playwright --force
    Write-Done "ms-playwright.playwright installed"
} catch {
    Write-Skip "VS Code not found or 'code' command not available"
}

# ── Step 2: Initialize npm project and install Playwright ─────────────────────
Write-Step 2 "Initializing npm project and installing Playwright..."
if (-not (Test-Path "package.json")) {
    npm init -y
    Write-Done "package.json created"
} else {
    Write-Skip "package.json already exists"
}
npm install --save-dev @playwright/test
Write-Done "@playwright/test installed"

# ── Step 3: Install browser binaries ──────────────────────────────────────────
Write-Step 3 "Installing Playwright browser binaries..."
npx playwright install
Write-Done "Chromium, Firefox, and WebKit binaries installed"

# ── Step 4: Generate playwright.config.ts ─────────────────────────────────────
Write-Step 4 "Generating playwright.config.ts..."
if (-not (Test-Path "playwright.config.ts")) {
    $config = @'
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  ],
});
'@
    Set-Content -Path "playwright.config.ts" -Value $config -Encoding UTF8
    Write-Done "playwright.config.ts created"
} else {
    Write-Skip "playwright.config.ts already exists"
}

# ── Step 5: Install Playwright CLI globally ────────────────────────────────────
Write-Step 5 "Installing @playwright/cli globally..."
npm install -g @playwright/cli@latest
$cliVersion = playwright-cli --version
Write-Done "playwright-cli v$cliVersion installed"

# ── Step 6: Initialize Playwright Agents for VS Code ──────────────────────────
if ($LLM) {
    Write-Step 6 "Initializing Playwright Agents for VS Code..."
    try {
        npx playwright init-agents --loop=vscode
        Write-Done "Agents generated in .github/agents/ (planner, generator, healer)"
    } catch {
        Write-Skip "Agent initialization failed or not supported"
    }
} else {
    Write-Step 6 "Skipping agent initialization (no LLM specified)"
    Write-Skip "Agent initialization requires -LLM parameter"
}

# ── Step 7: Update .gitignore ──────────────────────────────────────────────────
Write-Step 7 "Updating .gitignore..."
$entries = @('node_modules/')
if ($LLM -and $LLM -eq "Claude") {
    $entries += '.claude/'
}
if (Test-Path ".gitignore") {
    $existing = Get-Content ".gitignore" -Raw
    foreach ($entry in $entries) {
        if ($existing -notmatch [regex]::Escape($entry)) {
            Add-Content ".gitignore" "`n$entry"
            Write-Host "  + Added $entry" -ForegroundColor Green
        } else {
            Write-Skip "$entry already present"
        }
    }
} else {
    $entries | Set-Content ".gitignore" -Encoding UTF8
    Write-Done ".gitignore created"
}

# ── Step 8: Install Playwright CLI skills ─────────────────────────────────────
Write-Step 8 "Installing Playwright CLI skills..."
if ($LLM -and $LLM -eq "Claude") {
    try {
        playwright-cli install --skills
        Write-Done "Skills installed to .claude/skills/playwright-cli/"
    } catch {
        Write-Skip "Skill installation failed or not supported"
    }
} elseif ($LLM) {
    Write-Skip "Skills installation not supported for $LLM"
} else {
    Write-Skip "Skills installation requires -LLM parameter"
}

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Playwright setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "If using VS Code:" -ForegroundColor White
Write-Host "  Reload VS Code to activate the agents in the chat drop-down." -ForegroundColor Gray
Write-Host "  Ctrl+Shift+P -> Developer: Reload Window" -ForegroundColor Gray
Write-Host ""
Write-Host "Verify with:" -ForegroundColor White
Write-Host "  npx playwright test --list" -ForegroundColor Gray