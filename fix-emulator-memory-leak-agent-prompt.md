# Agent Prompt: Fix a Recurring Windows Emulator Memory Leak

Copy this prompt into a coding agent after replacing the angle-bracket placeholders.

---

Fix the recurring Windows emulator memory leak in:

`<REPOSITORY_ROOT>`

The affected service is:

`<AFFECTED_SERVICE_PATH>`

Work in your assigned worktree only. Read the repository's agent instructions first. Preserve all unrelated dirty changes. Do not stop, restart, or interfere with active agent or terminal sessions. Do not deploy or contact production services.

## Incident signature

- Dozens or hundreds of Google Cloud emulator Java processes accumulate after repeated test runs.
- Physical-memory and committed-memory usage continue growing after tests finish.
- Each process was launched by a local Datastore or Pub/Sub emulator command.
- The Vitest configuration uses `setupFiles`, which Vitest executes before every test file.
- The setup file starts emulators repeatedly.
- The current Windows cleanup terminates the gcloud or cmd wrapper but leaves Java descendants alive.
- The common Windows tree is `node -> cmd.exe -> python.exe (gcloud) -> cmd.exe -> java.exe`; signalling only the direct child does not reach the JVM.
- A port-only readiness check can mistake an old listener for the newly spawned emulator.
- Parallel agent worktrees use the same fixed emulator ports and can collide.

In one confirmed incident, about 46 test files caused roughly 92 emulator starts per full run. The machine accumulated 161 JVMs using 17.3 GB of physical memory and about 104 GB of private commit. Each orphan used approximately 110 MB of working set and 650 MB of private commit. Treat this as a process-lifecycle failure, not a test-data cleanup problem.

Inspect the live configuration before editing. Likely files include:

- `vitest.config.ts`
- `tests/setup.ts`
- `tests/helpers/emulators.ts`
- test state-reset helpers and service documentation

## Implement a durable solution

1. Start Datastore and Pub/Sub once per Vitest invocation using `globalSetup`, not once per test file.
2. Keep per-file and per-test data resets and mocks in `setupFiles`.
3. Allocate unique free Datastore and Pub/Sub ports for each invocation. Claim them with exclusive lock files in the system temporary directory so simultaneous worktrees back off. Reserve the historical fixed ports so hand-started or pre-existing emulators are never adopted or disturbed. Reap stale locks safely and remove every lock and registry artifact during teardown.
4. Pass the selected hosts to test workers before test modules import production code. Use supported Vitest mechanisms such as `project.provide()` and `inject()`. Read the injected addresses at setup-module scope so environment variables are set before test collection and before any production module constructs a cloud client.
5. Preserve every production-write guard. Emulator-backed tests must never silently fall through to real cloud services.
6. On Windows, terminate the complete owned process tree, including cmd, gcloud Python, batch files, and Java children. Use a safe equivalent of:

   `taskkill.exe /PID <owned-root-pid> /T /F`

   Never kill processes by executable name. After tree termination, sweep only verified descendants from that owned root. Match process creation time as well as PID so a recycled PID can never be touched.
7. Preserve POSIX process-group cleanup.
8. Clean up after normal completion, startup failure, readiness timeout, test failure, partial startup, `SIGINT`, and `SIGTERM`. Include a synchronous process-exit backstop for cleanup that cannot await.
9. Never accept “the port is open” as proof that the newly spawned process started successfully. Require both:
   - a protocol-level service probe, individually time-bounded, such as a Datastore health request or a genuine Pub/Sub gRPC operation
   - proof that the listening PID descends from the exact root process this invocation spawned
10. If startup or either readiness check fails, terminate the process tree that was just created before propagating the error.

## Add early detection

Agents must receive a warning before memory exhaustion:

1. Add a read-only emulator health command exposed through `package.json`, for example:

   `npm run emulators:doctor`

2. Report:
   - matching Datastore and Pub/Sub JVM count
   - PID, age, port, and ownership or ancestor status where available
   - aggregate working-set and private-memory usage
   - system available RAM and commit headroom on Windows
   - whether processes appear orphaned
3. Return a nonzero exit code with a loud, actionable warning when orphan emulators, dangerous counts, or low-memory conditions are detected. Use conservative configurable thresholds; a proven starting point is to warn at four orphan JVMs and fail at ten.
4. Run this preflight from Vitest global setup so direct `npx vitest` calls cannot bypass it.
5. Add concise agent-facing guidance telling agents to run the doctor command before and after emulator-backed tests.
6. Detection must not automatically kill active processes. Its remediation output must suggest exact PIDs, never executable-name kills. If cleanup support is added, make it a separate explicit command that terminates only verified orphan emulator trees and never agents, terminals, or unrelated Java processes.

## Audit behavior unmasked by the lifecycle fix

Moving host injection before module import can activate integration tests that previously skipped silently. Treat that as newly exposed coverage, not a regression in the lifecycle repair. Check for all of these:

- Tests that compute an `EMULATORS_READY`-style constant at module scope. Prove they now run instead of silently skipping.
- Low-level cloud clients that do not honor the same emulator environment variables as high-level wrappers. For example, a raw Pub/Sub `SubscriberClient` may not read `PUBSUB_EMULATOR_HOST` even when the high-level wrapper does. Construct low-level clients from emulator-resolved options and add a hard assertion that they are using an emulator before any request.
- Publisher and subscriber code using different project namespaces inside the emulator. Require the same test project where communication is expected.
- Pagination loops that trust only a cloud result-status flag. The Datastore emulator can report `MORE_RESULTS_AFTER_LIMIT` with an unchanged cursor after its final page. Also stop on an empty page or a non-advancing cursor so this cannot create an infinite loop.
- Integration assertions that still encode an older schema or counter contract. Compare them with the current production contract before changing either side.

## Verification requirements

- Add focused tests for process ownership, port allocation, health thresholds, and cleanup behavior.
- Run the suite twice sequentially and prove the emulator-process count returns to its starting value after each run.
- Run two bounded test invocations concurrently and record their distinct port pairs. Prove they do not corrupt each other's state and leave no new emulator processes.
- Exercise a forced partial startup where the first emulator succeeds and the second fails. Prove the first tree is reaped.
- Exercise a test failure and readiness failure and prove cleanup still occurs.
- Record before and after process counts and memory.
- Prove no stale port locks or registry files remain.
- Do not terminate active agent sessions or an emulator that an active test run still owns.
- Update stale comments and documentation that describe the leak as unavoidable.
- Run the relevant integration tests without skip guards and report newly exposed product/test defects separately from the lifecycle repair.
- Compare remaining failures with a pristine baseline checkout before classifying them as caused by this work.
- Make an atomic commit containing only this fix and report the commit, tests, process-count evidence, and any limitations.

## Required evidence format

Report:

- the three root causes found in the live code
- the files changed and the ownership rule used for every process terminated
- baseline emulator count and PID/port details for any pre-existing emulator left untouched
- process counts after two sequential runs, a concurrent run, and a forced partial-startup failure
- the distinct ports used by concurrent invocations
- total passing tests and any baseline-identical failures
- confirmation that production-write guards remain unchanged
- confirmation that no stale locks or registries remain

## Known residual limitation

A hard forced termination of the Vitest parent itself, such as `taskkill /F`, may bypass JavaScript signal and exit handlers and still orphan emulators. Do not claim this case is solved unless verified with an OS-level containment mechanism such as a Windows Job Object. The doctor preflight must detect and block on the resulting buildup at the next run.
