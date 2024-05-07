# Flakiness Dashboard Backend

This directory contains source code for the Azure function that we use to aggregate test reports.
The data is consumed by https://devops.playwright.dev/flakiness.html

## Publish

Azure Functions Core Tools is not available on macOS M1 yet, so we use GitHub Codespaces to publish the function.

### Via GitHub Codespaces:

- Install [Azure Functions Core Tools version 4](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=linux%2Cisolated-process%2Cnode-v4%2Cpython-v2%2Chttp-trigger%2Ccontainer-apps&pivots=programming-language-javascript):
  ```
  curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > microsoft.gpg
  mv microsoft.gpg /etc/apt/trusted.gpg.d/microsoft.gpg
  sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/microsoft-ubuntu-$(lsb_release -cs)-prod $(lsb_release -cs) main" > /etc/apt/sources.list.d/dotnetdev.list'
  apt-get update && apt-get install azure-functions-core-tools-4 sudo
  ```
- Install Azure CLI:
  ```bash
  curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
  ```
- Login to Azure:
  ```bash
  az login --use-device-code
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
