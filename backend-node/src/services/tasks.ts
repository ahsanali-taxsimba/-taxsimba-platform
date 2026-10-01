import { clean, col, Doc } from "../db/mongo";
import { logActivity, notify, nowIso, transition } from "../domain/workflow";
import { httpError } from "../http/errors";
import { isAdmin } from "./auth";

/** Completing a task is shared by the task endpoint and by an upload that fulfils a task. */
export async function completeTask(taskId: string, user: Doc): Promise<void> {
  const task = (await col("tasks").findOne({ id: taskId })) as Doc | null;
  if (!task) throw httpError(404, "Task not found");
  if (task.owner_id !== user.id && !isAdmin(user)) throw httpError(403, "Not your task");
  await col("tasks").updateOne(
    { id: taskId },
    { $set: { status: "COMPLETED", completed_date: nowIso() } },
  );
  const kase = clean((await col("cases").findOne({ id: task.case_id })) as Doc) as Doc;
  await logActivity(kase.id, `Task completed: ${task.name}`, user);
  if (task.owner_role === "CLIENT") {
    const openClientTasks = await col("tasks").countDocuments({
      case_id: kase.id,
      owner_role: "CLIENT",
      status: "OPEN",
    });
    if (kase.assigned_accountant_id) {
      await notify(
        kase.assigned_accountant_id,
        "Client completed a task",
        `${kase.client_name}: ${task.name}`,
        kase.id,
        `/work/cases/${kase.id}`,
        "TASK",
      );
    }
    if (openClientTasks === 0 && kase.status === "AWAITING_CLIENT") {
      await transition(
        kase,
        "ACCOUNTANT_REVIEW",
        user,
        "Client provided requested information — back to accountant",
      );
    }
  }
}
