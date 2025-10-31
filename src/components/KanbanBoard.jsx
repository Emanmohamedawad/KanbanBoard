import React, { useMemo, useRef, useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import { useQueryClient, useInfiniteQuery, useMutation } from "react-query";
import {
  fetchTasks,
  createTask,
  updateTask as apiUpdateTask,
  deleteTask as apiDeleteTask,
} from "../lib/api";

export default function KanbanBoard() {
  const columns = useMemo(
    () => [
      { id: "backlog", title: "Backlog" },
      { id: "in_progress", title: "In Progress" },
      { id: "review", title: "Review" },
      { id: "done", title: "Done" },
    ],
    []
  );

  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    column: "backlog",
  });
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formErrors, setFormErrors] = useState({ title: "" });
  const [deletingIds, setDeletingIds] = useState(new Set());

  const itemRefs = useRef(new Map());
  const setItemRef = (id, el) => {
    const key = String(id);
    if (el) {
      itemRefs.current.set(key, el);
    } else {
      itemRefs.current.delete(key);
    }
  };

  // data per column is fetched via React Query below

  const pageLimit = 10;

  function useColumnTasks(colId) {
    return useInfiniteQuery(
      ["tasks", colId, search, pageLimit],
      ({ pageParam = 1 }) => {
        const q = search?.trim();
        // When searching, fetch without column filter and filter client-side per column
        return fetchTasks({
          column: q ? undefined : colId,
          q,
          page: pageParam,
          limit: pageLimit,
        });
      },

      {
        getNextPageParam: (lastPage, allPages) =>
          lastPage.length < pageLimit ? undefined : allPages.length + 1,
        keepPreviousData: false,
        staleTime: 0,
        refetchOnMount: "always",
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 0,
      }
    );
  }

  // Create queries for all columns at top-level to keep hooks order stable
  const backlogQuery = useColumnTasks("backlog");
  const inProgressQuery = useColumnTasks("in_progress");
  const reviewQuery = useColumnTasks("review");
  const doneQuery = useColumnTasks("done");

  const columnQueries = useMemo(
    () => [backlogQuery, inProgressQuery, reviewQuery, doneQuery],
    [backlogQuery, inProgressQuery, reviewQuery, doneQuery]
  );
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState({ count: 0, columns: {} });

  // Use useEffect for search results calculation
  useEffect(() => {
    const searchTerm = search.trim().toLowerCase();
    if (!searchTerm) {
      setSearchResults({ count: 0, columns: {} });
      return;
    }

    let totalCount = 0;
    const newColumns = {};

    columns.forEach((col, i) => {
      const q = columnQueries[i];
      const all = (q.data?.pages || []).flat();
      const filtered = all.filter((t) => {
        const titleMatch = t.title?.toLowerCase().includes(searchTerm);
        const descMatch = t.description?.toLowerCase().includes(searchTerm);
        return (titleMatch || descMatch) && String(t.column) === col.id;
      });

      newColumns[col.id] = filtered.length;
      totalCount += filtered.length;
    });

    setSearchResults({
      count: totalCount,
      columns: newColumns,
    });
  }, [search, columns, columnQueries]);

  // Calculate if there are any results
  const anyResults = !search.trim() ? true : searchResults.count > 0;

  const mutations = {
    create: useMutation((task) => createTask(task), {
      onSuccess: () => {
        columns.forEach((c) => queryClient.invalidateQueries(["tasks", c.id]));
      },
    }),
    update: useMutation(({ id, updates }) => apiUpdateTask(id, updates), {
      onSuccess: (_, vars) => {
        // Get all affected columns and invalidate them
        columns.forEach((c) => queryClient.invalidateQueries(["tasks", c.id]));
      },
    }),

    delete: useMutation((id) => apiDeleteTask(id), {
      onSuccess: () => {
        columns.forEach((c) => queryClient.invalidateQueries(["tasks", c.id]));
      },
    }),
  };

  function handleEdit(task) {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      column: task.column,
    });
  }

  function handleDelete(id) {
    const key = String(id);
    setDeletingIds((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setTimeout(() => {
      mutations.delete.mutate(id, {
        onSettled: () => {
          setDeletingIds((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        },
      });
    }, 300);
  }

  function loadMore(fetchNextPage) {
    fetchNextPage();
  }

  function handleSaveNew() {
    if (!form.title.trim()) {
      setFormErrors((e) => ({ ...e, title: "Title is required" }));
      return;
    }

    // Get all existing tasks to find the next ID
    const allTasks = columns
      .map(
        (col) =>
          columnQueries.find((q) => q.data?.pages)?.data?.pages?.flat() || []
      )
      .flat();

    // Find the highest ID and increment by 1
    const maxId = allTasks.reduce((max, task) => {
      const taskId = parseInt(task.id);
      return taskId > max ? taskId : max;
    }, 0);

    const newTask = {
      id: String(maxId + 1),
      title: form.title.trim(),
      description: form.description.trim(),
      column: form.column || "backlog",
    };

    setFormErrors({ title: "" });
    mutations.create.mutate(newTask);
    setOpenNew(false);
    setForm({ title: "", description: "", column: "backlog" });
  }

  function handleSaveEdit() {
    if (!editing) return;
    mutations.update.mutate({
      id: editing.id,
      updates: {
        title: form.title,
        description: form.description,
        column: form.column,
      },
    });
    setEditing(null);
  }

  function onDragEnd(result) {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    const sourceCol = source.droppableId;
    const destCol = destination.droppableId;
    if (sourceCol === destCol && source.index === destination.index) return;

    const getTasksForCol = (colId) => {
      const idx = columns.findIndex((c) => c.id === colId);
      const query = columnQueries[idx];
      if (!query?.data?.pages) return [];
      return query.data.pages.flat();
    };

    const sourceItems = getTasksForCol(sourceCol);
    const destItems = getTasksForCol(destCol);
    const movedTask = sourceItems.find(
      (t) => String(t.id) === String(draggableId)
    );
    if (!movedTask) return;

    const updatedTask = { ...movedTask, column: destCol };

    // Optimistically update source column
    queryClient.setQueryData(["tasks", sourceCol, search, pageLimit], (old) => {
      if (!old?.pages) return old;
      const newPages = old.pages
        .map((page) =>
          page.filter((task) => String(task.id) !== String(draggableId))
        )
        .filter((page) => page.length > 0);
      return {
        ...old,
        pages: newPages.length > 0 ? newPages : [[]],
      };
    });

    // Optimistically update destination column
    queryClient.setQueryData(["tasks", destCol, search, pageLimit], (old) => {
      if (!old?.pages) return old;
      const allTasks = old.pages.flat();
      const updatedTasks = [
        ...allTasks.slice(0, destination.index),
        updatedTask,
        ...allTasks.slice(destination.index),
      ];

      // Re-paginate the tasks
      const newPages = [];
      for (let i = 0; i < updatedTasks.length; i += pageLimit) {
        newPages.push(updatedTasks.slice(i, i + pageLimit));
      }

      return {
        ...old,
        pages: newPages.length > 0 ? newPages : [[]],
      };
    });

    // Persist to backend
    mutations.update.mutate({
      id: draggableId,
      updates: { column: destCol },
    });
  }

  function handleSearchFocus() {
    const needle = search.trim().toLowerCase();
    if (!needle) return;
    for (const [id, el] of itemRefs.current.entries()) {
      const title = (el.getAttribute("data-title") || "").toLowerCase();
      const desc = (el.getAttribute("data-description") || "").toLowerCase();
      if (title.includes(needle) || desc.includes(needle)) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus({ preventScroll: true });
        break;
      }
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2
        className="my-6 text-center"
        style={{ fontSize: "2rem", color: "#4E61D3" }}
      >
        Kanban Board
      </h2>

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="start"
        mb={2}
        className="my-4"
      >
        {/* <h2 style={{ margin: 0 }}>Kanban Board</h2> */}
        <Box
          display="flex"
          justifyContent="space-between"
          gap={2}
          alignItems="flex-start"
        >
          <TextField
            size="small"
            placeholder="Search tasks by title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            sx={{
              width: "600px",
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
                backgroundColor: "white",
                transition: "all 0.2s ease",
                "&:hover": {
                  backgroundColor: "#f9fafb",
                },
                "&.Mui-focused": {
                  backgroundColor: "white",
                  boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
                },
              },
            }}
            InputProps={{
              startAdornment: (
                <SearchIcon
                  fontSize="small"
                  sx={{
                    mr: 1,
                    color: search ? "#3b82f6" : "#9ca3af",
                  }}
                />
              ),
              endAdornment: search && (
                <IconButton
                  size="small"
                  onClick={() => {
                    setSearch("");
                    setSearchResults({ count: 0, columns: {} });
                  }}
                  sx={{ mr: -0.5 }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              ),
            }}
            helperText={
              search.trim()
                ? searchResults.count > 0
                  ? (() => {
                      const matchingColumns = Object.entries(
                        searchResults.columns
                      )
                        .filter(([, count]) => count > 0)
                        .map(([colId, count]) => {
                          const colName = columns.find(
                            (c) => c.id === colId
                          )?.title;
                          return `${count} in ${colName}`;
                        });

                      return `Found ${searchResults.count} matching ${
                        searchResults.count === 1 ? "task" : "tasks"
                      } (${matchingColumns.join(", ")})`;
                    })()
                  : "No matching tasks found"
                : "Type to search in titles and descriptions"
            }
          />
          <Button
            variant="contained"
            onClick={() => {
              setForm({ title: "", description: "", column: "backlog" });
              setFormErrors({ title: "" });
              setOpenNew(true);
            }}
            className="font-bold "
            style={{ backgroundColor: "#4E61D3" }}
            sx={{ borderRadius: "10px", textTransform: "none" }}
          >
            Add Task
          </Button>
        </Box>
      </Box>

      <DragDropContext onDragEnd={onDragEnd}>
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "flex-start",
            overflowX: "hidden",
            width: "100%",
          }}
        >
          {columns.map((col, i) => {
            const query = columnQueries[i];
            const allItems = (query.data?.pages || []).flat();
            const items = search.trim()
              ? allItems.filter((t) => String(t.column) === col.id)
              : allItems;
            const hasMore =
              (query.data?.pages?.slice(-1)[0]?.length || 0) === pageLimit;
            return (
              <div key={col.id} style={{ flex: 1, minWidth: 260 }}>
                <h4
                  style={{
                    margin: "0 0 8px",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    color: "white",
                    backgroundColor:
                      col.id === "backlog"
                        ? "#3b82f6" // blue
                        : col.id === "in_progress"
                        ? "#8b5cf6" // purple
                        : col.id === "review"
                        ? "#f59e0b" // amber
                        : "#10b981", // emerald for done
                    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                    fontWeight: "600",
                  }}
                >
                  {col.title}
                </h4>
                <Droppable
                  droppableId={col.id}
                  direction="vertical"
                  isDropDisabled={false}
                >
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={{
                        background: "#f3f4f6",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: 8,
                        height: "80vh",
                        maxHeight: "calc(80vh - 120px)",
                        overflowY: "auto",
                        overflowX: "visible",
                        display: "flex",
                        flexDirection: "column",
                        scrollbarWidth: "thin",
                        scrollbarColor: "#cbd5e1 transparent",
                      }}
                    >
                      {items.map((task, index) => (
                        <Draggable
                          draggableId={String(task.id)}
                          index={index}
                          key={task.id}
                        >
                          {(provided) => (
                            <div
                              ref={(el) => {
                                provided.innerRef(el);
                                setItemRef(task.id, el);
                              }}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                background: "white",
                                border: "1px solid #e5e7eb",
                                borderRadius: 8,
                                padding: 12,
                                marginBottom: 8,
                                opacity: deletingIds.has(String(task.id))
                                  ? 0
                                  : 1,
                                transition: "all 300ms ease",
                                wordBreak: "break-word",
                                boxShadow:
                                  search.trim() &&
                                  (task.title
                                    ?.toLowerCase()
                                    .includes(search.toLowerCase()) ||
                                    task.description
                                      ?.toLowerCase()
                                      .includes(search.toLowerCase()))
                                    ? "0 0 0 2px #3b82f6, 0 1px 3px rgba(0,0,0,0.1)"
                                    : "0 1px 2px rgba(0, 0, 0, 0.05)",
                                backgroundColor:
                                  search.trim() &&
                                  (task.title
                                    ?.toLowerCase()
                                    .includes(search.toLowerCase()) ||
                                    task.description
                                      ?.toLowerCase()
                                      .includes(search.toLowerCase()))
                                    ? "#f0f7ff"
                                    : "white",
                                ...provided.draggableProps.style,
                              }}
                              tabIndex={-1}
                              data-title={task.title || ""}
                              data-description={task.description || ""}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                }}
                              >
                                <div>
                                  <strong>{task.title}</strong>
                                  <div style={{ marginTop: 8 }}>
                                    {task.description}
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEdit(task)}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDelete(task.id)}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {hasMore && (
                        <div style={{ textAlign: "center", marginTop: 8 }}>
                          <Button
                            disabled={query.isFetchingNextPage}
                            onClick={() => loadMore(query.fetchNextPage)}
                          >
                            {query.isFetchingNextPage
                              ? "Loading..."
                              : "Load more"}
                          </Button>
                        </div>
                      )}

                      {items.length === 0 && !query.isLoading && (
                        <div style={{ padding: 12, color: "#6b7280" }}>
                          No tasks
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
      {search.trim() && !anyResults && (
        <div style={{ padding: "8px 12px", marginTop: 8, color: "#6b7280" }}>
          No results found
        </div>
      )}

      <Dialog open={openNew} onClose={() => setOpenNew(false)} fullWidth>
        <DialogTitle>Create Task</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Title"
              value={form.title}
              onChange={(e) => {
                const v = e.target.value;
                setForm((s) => ({ ...s, title: v }));
                if (v.trim()) setFormErrors((er) => ({ ...er, title: "" }));
              }}
              error={!!formErrors.title}
              helperText={formErrors.title || ""}
            />
            <TextField
              label="Description"
              multiline
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm((s) => ({ ...s, description: e.target.value }))
              }
            />
            <TextField
              label="Column"
              value={form.column}
              onChange={(e) =>
                setForm((s) => ({ ...s, column: e.target.value }))
              }
              helperText="Use: backlog, in_progress, review, done"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNew(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveNew}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth>
        <DialogTitle>Edit Task</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Title"
              value={form.title}
              onChange={(e) =>
                setForm((s) => ({ ...s, title: e.target.value }))
              }
            />
            <TextField
              label="Description"
              multiline
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm((s) => ({ ...s, description: e.target.value }))
              }
            />
            <TextField
              label="Column"
              value={form.column}
              onChange={(e) =>
                setForm((s) => ({ ...s, column: e.target.value }))
              }
              helperText="Use: backlog, in_progress, review, done"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
