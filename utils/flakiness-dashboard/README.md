# Flakiness Dashboard Backend

This directory contains source code for the Azure function that we use to aggregate test reports.
The data is consumed by https://devops.playwright.dev/flakiness.html

To publish function:
- Install [Azure Functions Core Tools version 4.x.](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local).
  - This is as of Nov 2023 not available for macOS M1. So you can either use Rosetta or use GitHub Codespaces.
- Install Azure CLI (`brew update && brew install azure-cli`) && login via `az login`
- Make sure to run `npm install` to populate `node_modules/` folder (this folder will be published as-is).
- Run `/tmp/azure-functions-cli/func azure functionapp publish folio-flakiness-dashboard --javascript`
