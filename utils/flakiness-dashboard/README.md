# Flakiness Dashboard Backend

This directory contains source code for the Azure function that we use to aggregate test reports.
The data is consumed by https://devops.playwright.dev/flakiness.html

## Publish

- Install [Azure Functions Core Tools version 4](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=macos%2Cisolated-process%2Cnode-v4%2Cpython-v2%2Chttp-trigger%2Ccontainer-apps&pivots=programming-language-javascript):
  ```
  brew tap azure/functions
  brew install azure-functions-core-tools@4
  # if upgrading on a machine that has 2.x or 3.x installed:
  brew link --overwrite azure-functions-core-tools@4
  ```
- Install Azure CLI:
  ```bash
  brew update && brew install azure-cli
  ```
- Login to Azure CLI and select the subscription (popup will open):
  ```bash
  az login
  ```
- Install NPM Deps (`node_modules/` folder will be published as-is):
  ```
  cd utils/flakiness-dashboard/
  npm install
  ```
- Publish:
  ```bash
  func azure functionapp publish folio-flakiness-dashboard --javascript
  ```
