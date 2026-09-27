# KYC Review Queue

The same internal compliance tool built three ways, so the approaches can be compared
side by side — plus a fourth, Part C, that runs the Part A code *inside* Power Apps:

| | What it is | How it was built | Where it runs |
|---|---|---|---|
| **Part A** | Custom web app: React + TypeScript front end, Node/Express API, SQLite | Written as ordinary code in this Git repository | Locally: `npm install && npm run dev` |
| **Part B** | Power Apps **canvas** app on Dataverse | Authored as `.pa.yaml` source with the [`canvas-app` skill](https://github.com/microsoft/power-platform-skills/tree/main/plugins/canvas-apps) from Microsoft's power-platform-skills — its Canvas Authoring MCP server, connected to a live Power Apps Studio session | Power Apps (links below) |
| **Part B′** | Power Apps **model-driven** app on the same Dataverse tables | Generated headlessly from a JSON app spec with the [`app-builder` skill](https://github.com/microsoft/power-platform-skills/tree/main/plugins/model-apps) from Microsoft's power-platform-skills, through the Dataverse API — no Studio, no browser | Power Apps (links below) |
| **Part C** | Power Apps **code app** (preview): the Part A React front end, unchanged, on the same Dataverse tables | Ordinary code in this repository (`codeapp/`), published headlessly with Microsoft's [Power Apps CLI](https://learn.microsoft.com/power-apps/developer/code-apps/) as a service principal | Power Apps (link below) |

**Built with Devin.** All three parts were built by [Devin](https://devin.ai), Cognition's AI
software engineer, from a written brief. Devin wrote the Part A code and tests, the Dataverse
provisioning and seed scripts, the canvas app's `.pa.yaml` source and the model-driven app spec,
and deployed Parts B, B′ and C to the Power Platform environment. The author set the scope, signed
in to Power Apps Studio where a person was required, reviewed every pull request and tested each
app, sending back the issues that Devin then fixed (for example gallery layout and column names
in Part B, and the default queue view in Part B′). The recordings in each section show the
finished apps; the Part B screenshot shows Devin driving Studio mid-build.

**All data is synthetic.** Names, documents, addresses and check results are invented.

## The workflow

A compliance reviewer works a queue of applicant onboarding cases that were routed for
manual review. In every version the reviewer can:

1. **See the queue** — applicant, submission date, status, assigned reviewer and the reason
   the case needs a human look. Filter by status, search by applicant name or case reference.
   Flagged cases are marked.
2. **Open a case** — the applicant's submitted details, the simulated verification checks
   (pass / review / fail) and the case's activity history.
3. **Decide** — *Approve*, *Request more information* or *Escalate*. A written reason is
   mandatory.
4. **See the history** — every submission, assignment, flag and decision is logged with
   who did it, why, and when.
5. **Rely on final decisions** — once a case is *Approved* or *Escalated* it is closed and no
   further decision can be recorded. *Info requested* keeps the case open for a follow-up
   decision.

All versions hold the same eight synthetic cases (see [docs/seed-data.md](docs/seed-data.md)). Each part
below has a short screen recording of the flow.

---

## Part A — custom web app

| Layer | Choice |
|---|---|
| Front end | React 19 + TypeScript, Vite, React Router |
| API | Node.js ≥ 22.13 + Express 5, TypeScript run directly by Node (no build step) |
| Database | SQLite via Node's built-in `node:sqlite` (no native dependencies, no server to run) |
| Tests / lint | `node:test`, ESLint, `tsc --noEmit` |

The front end talks to the API over JSON (`/api/...`); the API validates every decision and
writes the status change and the history entry in one SQLite transaction.

![Part A walkthrough: queue, case detail, decision with reason, locked final state](docs/media/part-a-web-app.webp)

### Run it

Requires Node.js 22.13 or newer (`node --version`; Node 24 recommended).

```bash
npm install
npm run dev        # API on :3001, UI on http://localhost:5173
```

On first start the API creates `server/data/kyc.sqlite` and seeds the eight cases. The file
is kept between restarts, so decisions and history persist.

---

## Part B — Power Apps canvas app

**App:** *KYC Review Queue coauthored* · **Environment:** `https://org64ad231d.crm11.dynamics.com`
(UK region, id `b76846b4-0c24-e4d8-952c-46ffa09ad6a8`)

- Play: <https://apps.powerapps.com/play/e/b76846b4-0c24-e4d8-952c-46ffa09ad6a8/a/6344a16e-0ddd-4083-b5eb-518f13f4116d?tenantId=c6a3b549-494b-4711-b35d-2671b4f06cde>
- Edit in Studio: <https://make.powerapps.com/environments/b76846b4-0c24-e4d8-952c-46ffa09ad6a8/apps/6344a16e-0ddd-4083-b5eb-518f13f4116d>

Sign in to <https://make.powerapps.com> with an account that has access to that environment
and select it in the environment switcher (top right). **Tables → KYC Case / Verification
Check / KYC Case Activity** show the seeded records.

![Part B walkthrough: canvas app queue and case detail in the Power Apps player](docs/media/part-b-canvas-app.webp)

### How it was built

1. **Data first.** The three Dataverse tables were created by scripts in `dataverse/`
   (see [Rebuilding the Dataverse side](#rebuilding-the-dataverse-side)). `dataverse/scripts/schema.ts`
   mirrors the SQLite schema, and the seed reuses `server/src/seed.ts`, so Parts A and B hold
   identical data.
2. **App authored as source.** A Power Apps Studio tab is opened on the app and signed in by
   a person; Microsoft's Canvas Authoring MCP server attaches to that live *coauthoring
   session* (the `canvas-app` skill from the same [power-platform-skills](https://github.com/microsoft/power-platform-skills)
   repo). The screens are written as `.pa.yaml` files, validated and pushed with
   `compile_canvas`, and the server-normalised source is pulled back with `sync_canvas`.
   The result is a real app that opens in Studio, publishes and plays — and committable
   source rather than an opaque `.msapp`.
3. **Constraint:** the Studio tab must stay open and signed in throughout; the process is
   agent-driven but not unattended.

![Part B being built: the agent session on the left edits .pa.yaml and calls compile_canvas; the live app in the Power Apps player on the right picks up the change](docs/media/part-b-coauthoring-session.png)

*Building Part B: agent session on the left, the live Studio coauthoring session it is driving on
the right.*

Source lives in `powerapps-coauthored/` (`REPORT.md` has the notes on what worked and what did
not). Two screens: the queue (search + status filter over `KYC Cases`, flag and risk markers) and
the case detail (applicant fields, checks, history, required-reason input, Approve / Request
info / Escalate buttons that `Patch` the case and append an activity row; Approved / Escalated
cases are locked).

---

## Part B′ — Power Apps model-driven app, built headlessly

**App:** *KYC Review (model-driven)*, same environment and tables as Part B.

- Play: <https://org64ad231d.crm11.dynamics.com/main.aspx?appid=79defb02-eb8a-47ae-bdbf-e4a466dc89ff>

![Part B′ walkthrough: model-driven queue view, case form and command-bar decision](docs/media/part-b-prime-model-driven.webp)

### How it was built

1. `powerapps-model/app-spec.json` describes the app: which tables to reuse, the views
   (Review queue / Flagged cases / All cases / Case history / Checks), the case form with
   verification-check and history sub-grids, and the Approve / Request information / Escalate
   command-bar buttons.
2. The `app-builder` skill from Microsoft's [power-platform-skills](https://github.com/microsoft/power-platform-skills)
   (`plugins/model-apps`, `build-model-app.js --apply --publish --verify`) reads the spec and creates every artifact — solution, views, form, commands, web resource, app module —
   through the Dataverse Web API as a service principal, then reads them back to verify.
   **No Studio, no browser, no human in the loop.**
3. A small script (`powerapps-model/postbuild.mts`) then sets the details the generator
   can't: which view opens by default, which columns the search box looks at, and wiring up
   the form script.
4. Two rules — a decision needs a written reason, and approved/escalated cases can't be
   changed — are enforced by a short script on the case form
   (`powerapps-model/kyc_casecommands.js`).

---

## Part C — the Part A front end as a Power Apps code app

**App:** *KYC Review Queue (code app)*, same environment and tables as Part B.

- Play: <https://apps.powerapps.com/play/e/b76846b4-0c24-e4d8-952c-46ffa09ad6a8/app/c7ac350b-c374-4e15-9d24-90915780f640?tenantId=c6a3b549-494b-4711-b35d-2671b4f06cde>

[Code apps](https://learn.microsoft.com/power-apps/developer/code-apps/) (preview) let an
ordinary web app run inside Power Apps: Power Apps hosts it, signs the user in, applies the
environment's Dataverse security roles and DLP policies, and provides the data connections.
Part C takes the Part A React client as-is — same pages, components and styles — and swaps the
JSON API adapter (`client/src/api.ts`) for one that talks to the `kyc_*` Dataverse tables through
the Power Apps SDK (`codeapp/src/api.ts`). There is no Express server and no SQLite; the "acting
as" dropdown is replaced by the signed-in Power Apps user.

### How it was built

1. `pa app init` (the npm `@microsoft/power-apps-cli`) registers the app in the environment and
   writes `codeapp/power.config.json`.
2. `pa app add data-source --connector dataverse --table kyc_case` (and the two other tables)
   generates typed models and CRUD services under `codeapp/src/generated/` from the live table
   metadata.
3. `npm run build -w codeapp && pa app push` builds the Vite bundle and publishes it. Both steps
   ran **headlessly as the service principal** (`PA_CLI_USE_SP_AUTH=true` plus the `PA_CLI_SP_*`
   variables), after the principal was registered as a Power Platform management app
   (`pac admin application register`) and the environment admin turned on *Power Apps code
   apps* in the admin centre (Settings → Product → Features).

Local development is `pa app run` from `codeapp/`, which serves the Vite dev server behind the
Power Apps player. What is committed: the app source, `power.config.json` (environment and app
ids — no secrets) and the generated `.power/` and `src/generated/` files, so `npm run build -w
codeapp && pa app push` from a clean clone republishes the same app.

**Caveats.** Code apps are in preview; running one in production needs Power Apps Premium (or
pay-as-you-go) for each end user, which the developer environment used here does not test. As in
Parts B and B′, the decision and the history row are two separate Dataverse writes from the
browser and the reason-required / final-state rules run in the client — Part A's API-side
enforcement and single transaction do not carry over without a server or Dataverse plugin.

---

## Rebuilding the Dataverse side

Parts B, B′ and C share three Dataverse tables (`kyc_case`, `kyc_verificationcheck`,
`kyc_caseactivity`), created and seeded by scripts in `dataverse/`, authenticated as a
service principal that is an application user in the environment:

```bash
export PP_ENV_URL=https://org64ad231d.crm11.dynamics.com
export PP_TENANT_ID=c6a3b549-494b-4711-b35d-2671b4f06cde
export PP_CLIENT_ID=...  PP_CLIENT_SECRET=...

npm run provision -w dataverse   # publisher, solution, tables, columns, relationships (idempotent)
npm run seed -w dataverse        # the eight cases (idempotent; add `-- --reset` to wipe and reseed)
```

Then, for Part B′: run the `model-apps` builder against `powerapps-model/app-spec.json`, followed
by `node powerapps-model/postbuild.mts` (same `PP_*` variables). Part B is rebuilt by pushing
`powerapps-coauthored/app-src/` through the Canvas Authoring MCP server with a Studio session open.
Part C is rebuilt with `npm run build -w codeapp && npx pa app push` from `codeapp/`
(`PA_CLI_USE_SP_AUTH=true`, `PA_CLI_SP_CLIENT_ID`, `PA_CLI_SP_CLIENT_SECRET`, `PA_CLI_SP_TENANT_ID`,
`PA_CLI_ENVIRONMENT_ID`).

---

## Known limitations

- No authentication or authorisation in Part A; the acting reviewer is chosen from a dropdown.
- Verification checks are static seed data, not calls to a real KYC provider.
- Part A uses a single SQLite file — fine for a prototype, not for multi-instance deployment.
- No "reject" decision: the three actions (approve / request info / escalate) were chosen to
  keep the pilot small.
- The three versions hold the same eight synthetic cases, but as separate datasets (SQLite for
  Part A, Dataverse for B, B′ and C). Nothing here demonstrates migrating an existing Power App or
  its live data.
- Parts B, B′ and C exist only in the developer environment they were built in; there is no
  exported solution package to install them anywhere else.
- Part C relies on a preview feature (code apps) and its end-user licensing was not tested.
