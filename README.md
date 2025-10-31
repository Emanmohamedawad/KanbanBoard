# Kanban Board – Jira-Style Task Management

A **modern, responsive Kanban board** built with **Next.js 16**, **React Query**, **Zustand**, **Redux**, **Bootstrap**, and **Material UI**.  
Features **smooth drag-and-drop**, **infinite scroll**, **search**, **CRUD**, and **real-time sync** with a mock API.

---

🚀 Getting Started

Follow these steps to set up and run the project locally.

📦 1. Install Dependencies
npm install

🧪 2. Set Up Mock API

Install json-server globally (only once):

npm install -g json-server


Start the mock API server:

npm run json-server


This will serve mock data from the db.json file at:

http://localhost:4000

💻 3. Start the Development Server

In a separate terminal, run:

npm run dev


Then open your browser and navigate to:

http://localhost:3000


## Features

| Feature | Description |
|-------|-----------|
| **4 Columns** | Backlog → In Progress → Review → Done |
| **Drag & Drop** | Smooth, Jira-like with drag handle and visual feedback |
| **CRUD Operations** | Create, Edit, Delete tasks |
| **Infinite Scroll** | Load more tasks per column |
| **Search** | Filter by title or description with dropdown preview |
| **Optimistic Updates** | Instant UI, rollback on error |
| **State Management** | Zustand (tasks) + Redux (UI) |
| **Caching** | React Query + localStorage persistence |
| **Styling** | Bootstrap 5 + Material UI (no Tailwind) |
| **React Compiler** | Next.js 16 optimized performance |

---

## Tech Stack

- **Next.js 16** (App Router)
- **React Query v5** (data fetching & caching)
- **Zustand** (task state)
- **Redux Toolkit** (UI state)
- **react-beautiful-dnd** (drag & drop)
- **Bootstrap 5** (layout)
- **Material UI** (components & icons)
- **JSON Server** (mock API)

---

## Project Structure
src/
├── app/
│   └── layout.js        # Global providers + Bootstrap
├── components/
│   └── KanbanBoard.jsx  # Main board with DND
├── lib/
│   └── api.js           # API calls
├── store/
│   ├── kanbanStore.js   # Zustand store
│   └── kanbanUiSlice.js # Redux UI slice
└── db.json              # Mock data
