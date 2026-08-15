---
description: "Init: create the task record and decide whether Execute applies"
---

Load `mdgraph-loop`. The user is starting a new task.
Read `references/workflow.md`, apply its task-selection and resume rules (resume an existing matching task if one applies), otherwise resolve to Init and load `references/init.md`.
