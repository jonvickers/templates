# Codex AGENTS.md — Asana Example

Example of baking Asana API context into a Codex `AGENTS.md` so it's always
available to the agent. Copy the relevant sections into `~/.codex/AGENTS.md`
and swap in your own GIDs. The token stays in an env var — never in the file.

---

## Secrets
- Never store tokens/keys/passwords in this file.
- Asana auth: read token from PowerShell env var `ASANA_PAT`.

## Asana Defaults
- Assignee: Jon Vickers — GID `6093664670429`.
- Workspace/org GID: `6093785693798`.
- Style: one parent task + subtasks (not many standalone tasks) unless asked otherwise.
- Deferred work → `Later` section; default due date ~1 week out unless specified.

## Project: Foreclosure Bids List
- Project GID: `1208164153829532` · `Later` section GID: `1208273259695085`.
- URL: https://app.asana.com/1/6093785693798/project/1208164153829532/list/1208164313266760

## Asana API Quick Reference
- Base: `https://app.asana.com/api/1.0` · Header: `Authorization: Bearer $env:ASANA_PAT`
- Verify token owner: `GET /users/me?opt_fields=gid,name,email`
- Sections: `GET /projects/{project_gid}/sections?opt_fields=gid,name`
- Create task: `POST /tasks` · add to section: `POST /tasks/{task_gid}/addProject` (`project`+`section`)
- Subtask: `POST /tasks/{parent_gid}/subtasks` · List tasks: `GET /projects/{project_gid}/tasks?limit=100`
- Delete only when explicitly replacing a prior created task: `DELETE /tasks/{task_gid}`

## PowerShell
```powershell
$headers = @{ Authorization = "Bearer $env:ASANA_PAT"; "Content-Type" = "application/json" }
# If $env:ASANA_PAT is unset, ask Jon to run: $env:ASANA_PAT = "<token>"  (persist: setx ASANA_PAT "<token>", then restart Codex)
```
