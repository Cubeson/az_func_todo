const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { v4: uuidv4 } = require('uuid');

const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);
const database = client.database(process.env.DATABASE_ID);
const container = database.container(process.env.CONTAINER_ID);


app.http('home', {
    route: '',
    methods: ['GET'],
    handler: async (req) => {
        return {
            headers: { 'content-type': 'text/html' },
            body: `
<!DOCTYPE html>
<html>
<head>
  <title>TODO List</title>
  <style>
    body { font-family: Arial; margin: 20px; }
    .task { padding: 5px; border-bottom: 1px solid #ccc; }
    .done { color: #888; text-decoration: line-through; }
    button { margin-left:10px; }
  </style>
</head>
<body>
  <h1>Add New Task</h1>
  <form id="todoForm">
    <label>Text:</label><br>
    <input type="text" id="text" required><br><br>
    <label>Deadline:</label><br>
    <input type="date" id="deadline" required><br><br>
    <button type="submit">Add Task</button>
  </form>
  <p id="message" style="color:green;"></p>
  <h2>Task List</h2>
  <button id="refreshBtn">Refresh List</button>
  <div id="taskList"></div>
 <script>
    const apiBase = '/api/todos';

    async function loadTasks() {
      const listDiv = document.getElementById('taskList');
      listDiv.innerHTML = '<p>Loading...</p>';
      try {
        const res = await fetch(apiBase);
        const todos = await res.json();
        if (!todos.length) {
          listDiv.innerHTML = '<p>No tasks found.</p>';
          return;
        }
        listDiv.innerHTML = '';
        todos.forEach(todo => {
          const div = document.createElement('div');
          div.className = 'task' + (todo.completed ? ' done' : '');
          div.innerHTML =
            '<strong>' + todo.Text + '</strong> (Deadline: ' + todo.Deadline + ') ' +
            (todo.completed ? '[Completed]' : '[ ]');

          if (!todo.completed) {
            const completeBtn = document.createElement('button');
            completeBtn.textContent = 'Mark as Completed';
            completeBtn.onclick = async () => {
              await markCompleted(todo.id);
            };
            div.appendChild(completeBtn);
          }

          const delBtn = document.createElement('button');
          delBtn.textContent = 'Delete';
          delBtn.style.color = 'red';
          delBtn.onclick = async () => { await deleteTask(todo.id); };
          div.appendChild(delBtn);

          listDiv.appendChild(div);
        });
      } catch {
        listDiv.innerHTML = '<p style="color:red;">Error loading tasks</p>';
      }
    }

    async function deleteTask(id) {
      const res = await fetch(apiBase + '/' + id, { method: 'DELETE' });
      if (res.status === 204) { loadTasks(); showMsg('Task deleted.','green'); }
      else { showMsg('Failed to delete task.','red'); }
    }
    async function markCompleted(id) {
      const res1 = await fetch(apiBase + '/' + id);
      if (!res1.ok) return showMsg('Task not found.','red');
      const todo = await res1.json();
      todo.completed = true;
      const res2 = await fetch(apiBase + '/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(todo)
      });
      if (res2.ok) { loadTasks(); showMsg('Task marked as completed.','green'); }
      else { showMsg('Failed to mark complete.','red'); }
    }
    function showMsg(msg, color) {
      const m = document.getElementById('message');
      m.textContent = msg;
      m.style.color = color;
    }
    document.getElementById('todoForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const todo = {
        Text: document.getElementById('text').value,
        Deadline: document.getElementById('deadline').value,
        completed: false
      };
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(todo)
      });
      if (res.ok) {
        showMsg('Task added successfully!','green');
        this.reset();
        loadTasks();
      } else { showMsg('Error adding task!','red'); }
    });
    document.getElementById('refreshBtn').addEventListener('click', loadTasks);
    loadTasks();
  </script>
</body>
</html>
      `
        };
    }
});

app.http('getTodos', {
    route: 'todos',
    methods: ['GET'],
    handler: async (req) => {
        const { resources } = await container.items.query("SELECT * FROM c").fetchAll();
        return { status: 200, jsonBody: resources };
    }
});

app.http('createTodo', {
    route: 'todos',
    methods: ['POST'],
    handler: async (req) => {
        const todo = await req.json();
        todo.id = uuidv4();
        todo.completed = false;
        const { resource } = await container.items.create(todo);
        return { status: 201, jsonBody: resource };
    }
});

app.http('getTodo', {
    route: 'todos/{id}',
    methods: ['GET'],
    handler: async (req) => {
        const { id } = req.params;
        try {
            const { resource } = await container.item(id, id).read();
            return { status: 200, jsonBody: resource };
        } catch {
            return { status: 404, jsonBody: { error: 'Not found' } };
        }
    }
});

app.http('updateTodo', {
    route: 'todos/{id}',
    methods: ['PUT'],
    handler: async (req) => {
        const { id } = req.params;
        const todo = await req.json();
        todo.id = id;
        try {
            const { resource } = await container.item(id, id).replace(todo);
            return { status: 200, jsonBody: resource };
        } catch {
            return { status: 404, jsonBody: { error: 'Not found' } };
        }
    }
});

app.http('deleteTodo', {
    route: 'todos/{id}',
    methods: ['DELETE'],
    handler: async (req) => {
        const { id } = req.params;
        try {
            await container.item(id, id).delete();
            return { status: 204 };
        } catch {
            return { status: 404, jsonBody: { error: 'Not found' } };
        }
    }
});
