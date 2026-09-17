---
name: source-hygiene
description: Daily health check on the TV Scores source. Runs the static audit (dead code, duplication, naming, docs, coverage, credentials) then reviews by hand what a script cannot decide (comments, responsibilities, stale docs, missing tests). Reports findings; changes nothing.
---

# Source hygiene

Two halves. The first is measured, the second is judged. Do both, in order,
and report rather than repair.

## 1. The facts

From the repository root:

```sh
node scripts/audit.mjs
```

It exits non-zero on any finding. The coverage figure it prints is the proxy
only: the app's tests are Swift and run on the CI runner, not here. Check the
latest `tvOS build` run passed its "Run the tests" step rather than reporting
the app as untested. It covers: exports and modules nothing
imports, Swift types declared and never used, eight identical lines in two
places, naming drift, files past 260 lines, leftover markers and commented-out
code, documents naming files that do not exist, routes served but undocumented
or documented but gone, changes to `app/Sources` or `proxy/src` with nothing
written in `CHANGELOG.md`, line coverage under 70 percent, and any credential
outside `proxy/src/config.js`.

Everything it reports is a fact, so every finding is worth acting on. If it
reports nothing, say so and move to the second half.

## 2. What the script cannot decide

Look at what actually changed since the last check, not the whole repository:

```sh
git log --since="24 hours ago" --oneline
git diff --stat "@{24 hours ago}" HEAD
```

Read the diff of the files it names, and judge:

- **Comments.** Ones that restate the code instead of explaining why it is
  that way, and ones that have gone stale against the code beside them. A
  wrong comment is worse than none.
- **Responsibilities.** A file or function that has quietly taken on a second
  job. Length is already measured; this is about whether it still has one
  reason to change.
- **Naming.** Two things that do the same work under different names, or one
  name covering two different things.
- **Documentation.** Prose that is well-formed but no longer true. Behaviour
  that changed without its documentation following. The audit only checks that
  named paths and routes exist, never that a sentence is still honest.
- **Which document a thing belongs in.** `README.md` is the tour for a human
  arriving at the repository: what this is, how it fits together, where to
  look. `AGENTS.md` is how the work is done: commands, hard rules, conventions,
  directory responsibilities, open decisions. Anything said in both will go
  stale in one of them, which is how the README came to claim for days that the
  app is built on a MacBook. The audit catches sentences repeated verbatim;
  you have to catch the same fact told twice in different words, and material
  sitting in the wrong file.
- **Tests.** Assertions pinned to the implementation rather than the
  behaviour, and behaviour that shipped with no test at all. Coverage counts
  lines, not meaning.

## 3. Report

Rank findings by what would actually bite, with file and line. Be specific
enough that someone can act without re-deriving the problem.

**Do not change code, do not commit, do not push.** This runs unattended; a
finding is a decision for a person, and a repair made without context is how
a clean audit turns into a bad change.

If both halves are clean, say so in one line. Do not invent work to look
useful.
