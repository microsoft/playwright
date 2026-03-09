# Uploading a Fix for a GitHub Issue

## Branch naming

Create a branch named after the issue number:

```
git checkout -b fix-39562
```

## Committing changes

Use conventional commit format with a scope:

- `fix(proxy): description` — bug fixes
- `feat(locator): description` — new features
- `chore(cli): description` — maintenance, refactoring, tests

The commit body must be a single line: `Fixes: https://github.com/microsoft/playwright/issues/39562`

Stage only the files related to the fix. Do not use `git add -A` or `git add .`.

```
git add src/server/proxy.ts tests/proxy.spec.ts
git commit -m "$(cat <<'EOF'
fix(proxy): handle SOCKS proxy authentication

Fixes: https://github.com/microsoft/playwright/issues/39562
EOF
)"
```

## Pushing

Push the branch to origin:

```
git push origin fix-39562
```

## Full example

For issue https://github.com/microsoft/playwright/issues/39562:

```bash
git checkout -b fix-39562
# ... make changes ...
git add <changed-files>
git commit -m "$(cat <<'EOF'
fix(proxy): handle SOCKS proxy authentication

Fixes: https://github.com/microsoft/playwright/issues/39562
EOF
)"
git push origin fix-39562
```
