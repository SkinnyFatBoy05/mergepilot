import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalJson } from "../packages/evaluation/src/report.js";
import { evaluationTasks } from "../packages/evaluation/src/run-suite.js";

const output = resolve("evaluation/tasks");
await mkdir(output, { recursive: true });
for (const task of evaluationTasks) await writeFile(resolve(output, `${task.taskId}.json`), canonicalJson(task));
console.log(`Generated ${evaluationTasks.length} evaluation task manifests`);
