import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';

const initialColumns = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Done' },
];

const initialTasks = [
  { id: '1', title: 'Sample task 1', description: 'First task', column: 'backlog' },
  { id: '2', title: 'Sample task 2', description: 'Second task', column: 'in_progress' },
];

export const useKanbanStore = create(
  devtools(
    persist(
      (set, get) => ({
        columns: initialColumns,
        tasks: initialTasks,

        addTask: (task) =>
          set((state) => ({ tasks: [{ ...task, id: String(task.id ?? Date.now()) }, ...state.tasks] })),

        updateTask: (taskId, updates) =>
          set((state) => ({
            tasks: state.tasks.map((t) => (String(t.id) === String(taskId) ? { ...t, ...updates } : t)),
          })),

        deleteTask: (taskId) =>
          set((state) => ({ tasks: state.tasks.filter((t) => String(t.id) !== String(taskId)) })),

        moveTask: (taskId, destColumnId) =>
          set((state) => ({
            tasks: state.tasks.map((t) => (String(t.id) === String(taskId) ? { ...t, column: destColumnId } : t)),
          })),

        setTasks: (tasks) => set({ tasks: tasks ?? [] }),
        reset: () => set({ columns: initialColumns, tasks: initialTasks }),
      }),
      {
        name: 'kanban-state',
        storage: createJSONStorage(() => (typeof window !== 'undefined' ? window.localStorage : undefined)),
        partialize: (state) => ({ tasks: state.tasks }),
      }
    )
  )
);


