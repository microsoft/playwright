# Flakiness Dashboard Backend

This directory contains source code for the Azure function that we use to aggregate test reports.
The data is consumed by https://devops.aslushnikov.com/flakiness2.html

To publish function:
- install [Azure Functions Core Tools version 3.x.](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=v4%2Cmacos%2Ccsharp%2Cportal%2Cbash#v2).
- install Azure CLI && login via `az login`
- run `func azure functionapp publish folio-flakiness-dashboard --javascript`
