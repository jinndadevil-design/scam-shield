# Working agreement

## When to plan

- **Questions, small fixes, one-off edits:** just answer or do it. No planning ritual.
- **Multi-step projects** (new features, redesigns, pivots, anything spanning several sessions or files): use the Playbook method below *before* writing code.

## The Playbook method

### 1. Interview → `PLAYBOOK.md`
Don't start building from a one-line request. Interview the user first, a few sharp questions at a time, until the work is understood:
- What does *finished* look like? (concrete: what the user sees, does, or ships)
- Who is it for, and who signs it off?
- Constraints: deadline, budget, stack, things that must not change.
- What has been tried before, and what went wrong?

Push back on vague or contradictory answers instead of guessing. Then turn the answers into `PLAYBOOK.md` at the repo root:
- **Goal:** one or two sentences.
- **Steps / milestones:** in order, each small enough to verify on its own.
- **Rules:** decisions and preferences that must hold every time.
- **Done means:** see step 3.
- **Open questions / risks:** what is still unknown or could sink it.

Get the user's OK on the playbook before building.

### 2. Toolbox → `toolbox/`
Every reusable asset made during the project goes in `toolbox/`: approved scripts, templates, reference docs, brand assets, test fixtures. Add a rule to `PLAYBOOK.md` pointing to each one (e.g. `export: toolbox/export.py`) so later sessions reuse it instead of reinventing it.

### 3. Proof → "Done means" checklist
`PLAYBOOK.md` carries a checklist of what done looks like for this project: matches the brief, built from the toolbox, numbers and claims verified, tests and checks pass, ready to ship as is. Check your own work against it *before* showing the user anything, and report honestly which items pass and which don't.

### 4. The loop: Playbook → Run → Check → Fix
When something goes wrong, don't just patch it in chat ("no, do it like last time"). Fix the **playbook** (add the missing step, rule, or checklist item) so the mistake can't repeat in a later session. Re-read `PLAYBOOK.md` at the start of every session on the project.
