import axios from "axios";

const api = axios.create({ baseURL: "http://localhost:4000" });

export type Task = {
  id: string;
  title: string;
  description?: string;
  column: "backlog" | "in_progress" | "review" | "done" | string;
};

export async function fetchTasks(params: {
  column?: string;
  q?: string;
  page?: number;
  limit?: number;
}): Promise<Task[]> {
  const { column, q, page = 1, limit = 10 } = params;
  const query: Record<string, string | number> = {
    _page: page,
    _limit: limit,
    _sort: "id",
    _order: "asc",
  };
  if (q && q.trim()) query.q = q.trim();
  if (column) query.column = column;
  const res = await api.get("/tasks", { params: query });
  return res.data as Task[];
}

export async function createTask(task: Omit<Task, "id">): Promise<Task> {
  const res = await api.post("/tasks", task);
  return res.data as Task;
}

export async function updateTask(
  taskId: Task["id"],
  updates: Partial<Task>
): Promise<Task> {
  const res = await api.patch(`/tasks/${taskId}`, updates);
  return res.data as Task;
}

export async function deleteTask(taskId: Task["id"]): Promise<void> {
  await api.delete(`/tasks/${taskId}`);
}
