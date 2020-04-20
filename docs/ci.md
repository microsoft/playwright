# Continuous integration.md

Playwright tests can be executed to run on your CI environments. To simplify this, we have created sample configurations for common CI providers that can be used to bootstrap your setup.

#### Contents
- [Docker](#docker)
- [GitHub Actions](#github-actions)
- [Azure Pipelines](#azure-pipelines)
- [Travis CI](#travis-ci)
- [CircleCI](#circleci)
- [AppVeyor](#appveyor)

Broadly, configuration on CI involves **ensuring system dependencies** are in place, **installing Playwright and browsers** (typically with `npm install`), and **running tests** (typically with `npm test`). Windows and macOS build agents do not require any additional system dependencies. Linux build agents can require additional dependencies, depending on the Linux distribution.

<br/>

## Docker

We have a [pre-built Docker image](docker/README.md) which can either be used directly, or as a reference to update your existing Docker definitions.

## GitHub Actions

We run [our tests](/.github/workflows/tests.yml) on GitHub Actions, across a matrix of 3 platforms (Windows, Linux, macOS) and 3 browsers (Chromium, Firefox, WebKit). Use the [microsoft/playwright-github-action](https://github.com/microsoft/playwright-github-action) to bootstrap your GitHub Actions configuration.

## Azure Pipelines

For Windows or macOS agents, no additional configuration required, just install Playwright and run your tests.

For Linux agents, refer to [our Docker setup](docker/README.md) to see additional dependencies that need to be installed.

## Travis CI

We run our tests on Travis CI over a Linux agent (Ubuntu 18.04). Use our [Travis configuration](/.travis.yml) to see list of additional dependencies to be installed.

## CircleCI

We run our tests on CircleCI, with our [pre-built Docker image](docker/README.md). Use our [CircleCI configuration](/.circleci/config.yml) to create your own.

## AppVeyor

We run our tests on Windows agents in AppVeyor. Use our [AppVeyor configuration](/.appveyor.yml) to create your own.
