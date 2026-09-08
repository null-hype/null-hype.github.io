# GAP workshop runtime

This local service connects the tutorial and MCP Inspector to a Dagger verifier.
`policy/hk.pkl` imports authored Pkl modules; **hk 1.57.0's bundled Pkl evaluator**
evaluates vocabulary membership and rule values inside Dagger. A tiny Node hook
serializes those evaluated values to JSON. No standalone Pkl CLI is installed.
The Dagger compiler requires the author's installed hk binary and checks its version.

## Run

Requires Node 22+, Docker, Dagger 0.21.8, and hk 1.57.0 (available through mise).

```sh
npm ci
# Copy .env.example to .env and set HK_BIN to your installed hk binary.
npm start
# In a second terminal:
npm run inspector
```

The runtime listens on `127.0.0.1:8787`; Inspector listens on port 6274.
Open tutorial lesson 3 locally on port 4321 or 4322. Each new session returns a
link that opens Inspector with its session-bound MCP endpoint selected.
If your Docker credential helper is unavailable, use a separate `DOCKER_CONFIG`
with `{}` in its `config.json` for these public images; don't change global credentials.
First compilation downloads the Node image and matching hk schema.

## Author a change

Edit `policy/unadmitted.pkl` to add `"Schadenfreude"` to the actual vocabulary list,
then restart `npm start` to compile with hk in Dagger. The runtime publishes the
new compiled policy at `/policies`; create a new session to use it. A comment
containing the word has no effect. Invalid Pkl prevents startup. Policy source
and compiled fields are inspectable in the tutorial.

## Boundary and endpoints

- `GET /policies`: authored policy ids, source, and evaluated runtime JSON.
- `POST /sessions {"policyId":"unadmitted"}`: create a workshop session bound to
  an immutable compiled policy. `admitted` is the second authored example.
- `POST /sessions/:id/submit {"translation":"Schadenfreude"}`: invoke the same
  gated action used by MCP. Extra fields and policy overrides are rejected.
- `GET /sessions/:id`: glossary and actual events, including verifier errors.
- `/mcp/:id`: typed `submitLoanword` tool, usable through MCP Inspector.

A validated proposal goes to the Dagger `verify` function with the session's
compiled snapshot. Only a positive result with the matching policy hash permits
the bridge to add the word to the glossary. Failed checks, malformed requests,
unknown tools, and verifier failures cannot mutate it. Events distinguish
accepted, rejected, and error outcomes. Duplicate accepted words are idempotent.

This is a local teaching runtime, not a hosted security service. The lesson
explicitly allows the learner to create sessions under either authored policy;
that is the policy-author role. Tool calls within a session cannot choose policy.
Session ids are random capabilities, not user authentication. State is in memory,
cleared on restart, capped at 1,000 sessions and the latest 200 events per session.
Only listed local browser origins are allowed. Policy sources and the Dagger module
are trusted author code; there is no endpoint for arbitrary Pkl, shell, or Dagger
execution. Compilation occurs at startup and each valid submission invokes Dagger.
The decision tests exact preservation and explicit admission, not linguistic quality.

The compiler uses the subset supported by hk's bundled evaluator: scalar values
and direct list membership. JSON serialization happens after Pkl evaluation;
there is no text/regex vocabulary scan. The executor is pinned to a Node
22.16.0 Bookworm container and hk's required version; normal container tags are
version-pinned rather than content-addressed.

## Verify

```sh
npm test
npm run test:dagger
```

Unit tests exercise real HTTP and MCP with an injected verifier. Dagger integration
tests compile real Pkl through hk, check commented-out admission, edit/recompile
an authored module, and invoke the actual Dagger verifier with accepted, rejected,
and malformed proposals. The tutorial app has a separate browser regression.
Set `GAP_DAGGER_TEST=1` in the ignored local `.env` to include the real integration
tests in the standard `npm test` command. Without it, they are explicitly skipped.
