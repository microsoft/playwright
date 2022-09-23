---
id: vscode-extension
title: "VS Code Extension"
---

The VS Code Extension is meant to help its users in getting more of Playwright in a swift manner. From the testing explorer panel you can run one or multiple tests with the click of a button. You can even run them in debug mode. [For more information about installing the VS Code Extension, please see its getting started page](./getting-started-vscode-js.md).

## Making the VS Code Extension aware of your tests

It is important to notice that the VS Code Extension will only look for an installation of Playwright at each root folder added to the workspace. In case you have installed Playwright in a nested folder, you can still use the [CLI](./intro.md) to run tests from that folder, but the VS Code Extension will not be able to recognize such installation and, therefore, will not be able to work with it.

With this in mind, here are some common situations that might impose difficulties in getting the VS Code Extension to work, along with a suggestion to circumvent them.

### Run Tests from Multiple Root Folders

The VS Code extension will search for a Playwright config file at each root folder added to the workspace. Each root folder has its own root entry in the testing tree, but only those which have Playwright installed and some tests will be expandable. If a root folder does not have Playwright installed, then it will not be expandable.

For example, suppose that a given workspace has three root folders: "Client", "Docs" and "Server".

<img width="355" height="496" alt="A workspace with three folders: Client, Docs and Server." src="https://user-images.githubusercontent.com/594605/191968872-162c802e-7298-4943-b139-18d87487e667.png" />

Out of those, only "Client" and "Server" have Playwright installed.

<img width="353" height="442" alt="Testing tree showing that only the folders Client and Server have tests, while the folder Docs has not." src="https://user-images.githubusercontent.com/594605/191969322-a3b4eecf-ff34-486b-859e-58840dbef3d1.png" />

The dropdown menu **Select Configuration** will account for all the projects found in the folders "Client" and "Server".

<img width="446" height="186" alt="Testing tree showing that only Folder_B and Folder_C have tests, while Folder_A does not." src="https://user-images.githubusercontent.com/594605/191970160-32a56015-ce9c-48f3-b0e6-b479f4e44539.png" />

### Run Tests from Multiple Packages - Monorepos

In order to use the VS Code extension when multiple packages are nested inside the root folder, a structure usually called as monorepo, it is advisable to have Playwright installed at the root level package. By installing Playwright at the root level package, it is not necessary to have it installed in each nested package as well. Remember that the VS Code extension will not look for Playwright configuration files in nested folders.

However, a single Playwright configuration file can still be used to test many packages. And the tests for each package can still have their own set of independent options.

For example, suppose that a given root folder has a root level package, in which Playwright was installed, and three others packages in nested folders: "apps/client", "apps/server" and "libs/common".

<img width="355" height="458" alt="A file explorer with a root level package and three nested packages: 'apps/client', 'apps/server' and 'libs/common'." src="https://user-images.githubusercontent.com/594605/190917713-c51da6a0-7bde-49fd-a78a-0274b712367a.png" />

The Playwright configuration file at the root level package can define projects for each package by restricting the test files belonging to any given package.

<img width="432" height="754" alt="The property 'projects' of the Playwright configuration file describing three projects due to the package 'apps/client', one project due to the package 'apps/server' and one project due to the package 'libs/common'." src="https://user-images.githubusercontent.com/594605/190918095-035aa6fb-3efe-46ac-8ee8-4269ffe8dd7d.png" />

For more information about which options can be used when defining a project, please see the [options available for a project](./api/class-testproject.md).

The testing tree and the dropdown menu **Select Configuration** will account for all projects.

<img width="355" height="373" alt="The testing tree showing all tests belonging to all five projects." src="https://user-images.githubusercontent.com/594605/190918243-063936ea-e070-4297-8f40-776d9bd339ce.png" />

<img width="504" height="199" alt="The dropdown menu 'Select Configuration' showing all five projects." src="https://user-images.githubusercontent.com/594605/190918293-1b1e5f39-9178-4906-897d-a256ca48c147.png" />
