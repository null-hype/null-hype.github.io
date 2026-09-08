# GAP implementation map

The deployed application is `tutorial-app/` in `null-hype/null-hype.github.io`.
The root Netlify configuration builds this directory and publishes its `dist/`.
The `null-hype` Netlify project builds merges and PR previews. The custom domain
belongs to the separate `null-hype-tutorial-app` project, now also connected to
this repository's `master` branch. Verify the latter project's published commit
when checking `null-hype.tidelands.dev`; it previously used manual uploads.
These builds publish the static tutorial, not the companion Dagger runtime.
`null-hype/tutorial-kit` is a separate repository whose current branches do not
contain these deployed German lessons.

## Opening exercises: browser validation and illustrated results

| GAP role | Implementation | Boundary |
| --- | --- | --- |
| Authored rule | `LoanwordRules.pkl` in each lesson | Describes the source form and vocabulary-admission policy. |
| Runtime artifact | `loanword-runtime.json` | Checked in separately; there is no Pkl-to-JSON generation step here. |
| Proposal | Editable `translation.en` | Compared with the configured canonical string after trimming whitespace. |
| Vocabulary gate | `inspectVocabulary` in `src/lib/loanwordArcProtocol.ts` | Limited text inspection, not Pkl evaluation; not suitable as an authorization boundary. |
| Feedback | `LoanwordArcBridge` | Shows blocked, pending-admission, idle, and accepted states without requiring the preview to boot. |
| Result illustration | `otel-warm-log` template | Scripted example selected by validation state, not observed agent execution or telemetry. |

The preview announces readiness to the parent. The bridge answers with the
latest state, including after a slow WebContainer startup or a preview reload.
Edits also publish immediately to existing preview frames.

## Validation

Run `npm ci`, `npm run build`, then `npx playwright install chromium` and
`npx playwright test` from this directory. For an existing Chromium installation,
set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path.

The focused browser regression test delays the real preview document beyond
the former 6.4-second publication window. It checks rejection, vocabulary
admission, successful completion, preview reload, revocation, empty input,
and navigation to the rule and runtime artifact. Existing exploratory dump
and navigation scripts remain available but are not assertion-based release checks.

## From rule to action: executable lesson

`part-1/chapter-1/lesson-3` connects to the companion `../gap-runtime` service.
Follow that directory's README to compile the authored Pkl policies and run
the Dagger-backed MCP bridge and Inspector. The new lesson does not use the
opening exercises' handwritten runtime JSON or vocabulary text checker.

The author supplies Pkl rules and vocabulary. An hk hook evaluates the sources
with hk's bundled `pklr` backend inside Dagger and emits the runtime JSON;
the service exposes the source and compiled JSON for inspection. A learner
chooses an authored policy when creating an isolated, in-memory session. That
binding cannot be changed by a proposal. Accepted proposals add to that
session's glossary; rejected proposals leave it unchanged. The server records
calls made through either the lesson or MCP, and the lesson polls that record
so Inspector activity appears there too.

Changing the policy selector does not modify an existing session. Starting a
fresh session is an explicit new experiment. To change the authored rule,
edit its Pkl source and follow the runtime's compilation workflow. The public
API does not accept arbitrary Pkl source for execution.

With the actual runtime running on port 8787 and Inspector on port 6274, run the browser regression from
this directory:

```sh
npx playwright test --config playwright.execution.config.ts
```

Use `GAP_TEST_RUNTIME_URL` to test another runtime, or set
`PUBLIC_GAP_RUNTIME_URL` when building the tutorial to configure its default
connection address. The static Netlify page alone does not host Dagger.
Deploying the runtime as a public shared service requires a separate hosting
decision; the companion service is intended for a local workshop.

The action here is a session glossary update. This establishes a concrete
execution boundary for that action, not a claim about translation quality or
general agent containment. The previous lessons remain explicitly labeled
prototypes and are covered by their existing regression test.

The legacy thesis is reference material:
https://linear.app/tidelands-dev/issue/PLAN-229/the-four-layer-stack

New decisions are tracked in the MCP-connected workspace. Editorial review
of the loanword acceptance policy: CIT-31.
