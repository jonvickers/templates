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
- A port-only readiness check can mistake an old listener for the newly spawned emulator.
- Parallel agent worktrees use the same fixed emulator ports and can collide.

Inspect the live configuration before editing. Likely files include:

- `vitest.config.ts`
- `tests/setup.ts`
- `tests/helpers/emulators.ts`
- test state-reset helpers and service documentation

## Implement a durable solution

1. Start Datastore and Pub/Sub once per Vitest invocation using `globalSetup`, not once per test file.
2. Keep per-file and per-test data resets and mocks in `setupFiles`.
3. Allocate unique free Datastore and Pub/Sub ports for each Vitest invocation so simultaneous worktrees cannot collide.
4. Pass the selected hosts to test workers before test modules import production code. Use supported Vitest mechanisms such as `project.provide()` and `inject()` where appropriate.
5. Preserve every production-write guard. Emulator-backed tests must never silently fall through to real cloud services.
6. On Windows, terminate the complete owned process tree, including cmd, gcloud Python, batch files, and Java children. Use a safe equivalent of:

   `taskkill.exe /PID <owned-root-pid> /T /F`

   Never kill processes by executable name.
7. Preserve POSIX process-group cleanup.
8. Clean up after normal completion, startup failure, timeout, test failure, Ctrl+C, and partial startup where only one emulator started.
9. Never accept “the port is open” as proof that the newly spawned process started successfully. Confirm process ownership and liveness, or use the unique-port design to remove the ambiguity.

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
3. Return a nonzero exit code with a loud, actionable warning when orphan emulators, dangerous counts, or low-memory conditions are detected.
4. Run this preflight from Vitest global setup so direct `npx vitest` calls cannot bypass it.
5. Add concise agent-facing guidance telling agents to run the doctor command before and after emulator-backed tests.
6. Detection must not automatically kill active processes. If cleanup support is added, make it a separate explicit command that terminates only verified orphan emulator trees and never agents, terminals, or unrelated Java processes.

## Verification requirements

- Add focused tests for process ownership, port allocation, health thresholds, and cleanup behavior.
- Run the suite twice sequentially and prove the emulator-process count returns to its starting value after each run.
- Run two bounded test invocations concurrently and prove they use different ports, do not corrupt each other's state, and leave no new emulator processes.
- Exercise a forced startup or test failure and prove cleanup still occurs.
- Record before and after process counts and memory.
- Do not terminate active agent sessions or an emulator that an active test run still owns.
- Update stale comments and documentation that describe the leak as unavoidable.
- Make an atomic commit containing only this fix and report the commit, tests, process-count evidence, and any limitations.
