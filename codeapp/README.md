# Part C — code app

The Part A React client (`client/`) with three files swapped so it runs inside Power Apps as a
[code app](https://learn.microsoft.com/power-apps/developer/code-apps/) against the `kyc_*`
Dataverse tables:

- `src/api.ts` — same interface as Part A's (`listCases`, `getCase`, `submitDecision`), implemented
  over the generated Power Apps SDK services instead of `fetch('/api/...')`.
- The "acting as" dropdown is replaced by the signed-in Power Apps user (`getContext().user`).
- `MemoryRouter` instead of `BrowserRouter` — the Power Apps player owns the URL.

## How it was built

1. `pa app init` (npm `@microsoft/power-apps-cli`) registered the app in the environment and wrote
   `power.config.json`.
2. `pa app add data-source --connector dataverse --table kyc_case` (and the two other tables)
   generated typed models and CRUD services under `src/generated/` from the live table metadata.
3. `npm run build -w codeapp && pa app push` built the Vite bundle and published it.

Both steps ran headlessly as the service principal (`PA_CLI_USE_SP_AUTH=true` plus the
`PA_CLI_SP_*` variables), after the principal was registered as a Power Platform management app
(`pac admin application register`) and *Power Apps code apps* was turned on in the admin centre
(Settings → Product → Features).

## Rebuilding

`power.config.json` (environment and app ids — no secrets), `.power/` and `src/generated/` are
committed, so from a clean clone:

```bash
export PA_CLI_USE_SP_AUTH=true
export PA_CLI_SP_TENANT_ID=c6a3b549-494b-4711-b35d-2671b4f06cde
export PA_CLI_ENVIRONMENT_ID=b76846b4-0c24-e4d8-952c-46ffa09ad6a8
export PA_CLI_SP_CLIENT_ID=...  PA_CLI_SP_CLIENT_SECRET=...

npm run build -w codeapp && (cd codeapp && npx pa app push)
```

Local development: `pa app run` from `codeapp/` serves the Vite dev server behind the Power Apps
player.
