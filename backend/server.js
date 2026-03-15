const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:4200')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json());

let isMongoAvailable = false;
const memoryStore = {
  projects: [],
  tasks: []
};

const createMemoryId = () => {
  const chars = 'abcdef0123456789';
  let id = '';
  for (let i = 0; i < 24; i += 1) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
};

const errorResponse = (res, status, message) => {
  return res.status(status).json({ success: false, error: message });
};

const successResponse = (res, data, status = 200) => {
  return res.status(status).json({ success: true, data });
};

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/teamflow', {
  serverSelectionTimeoutMS: 3000
})
.then(() => {
  isMongoAvailable = true;
  console.log('MongoDB Connected');
})
.catch(err => {
  isMongoAvailable = false;
  console.log('MongoDB Connection Error:', err.message);
  console.log('Using in-memory fallback store');
});

const projectSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Project name is required'], trim: true },
  description: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now }
});

const taskSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Task title is required'], trim: true },
  description: { type: String, trim: true },
  status: { 
    type: String, 
    enum: { values: ['todo', 'in-progress', 'done'], message: 'Invalid status' }, 
    default: 'todo' 
  },
  priority: { 
    type: String, 
    enum: { values: ['low', 'medium', 'high'], message: 'Invalid priority' }, 
    default: 'medium' 
  },
  dueDate: { type: Date },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  createdAt: { type: Date, default: Date.now }
});

const Project = mongoose.model('Project', projectSchema);
const Task = mongoose.model('Task', taskSchema);

app.get('/api/health', (req, res) => {
  return successResponse(res, {
    status: 'ok',
    database: isMongoAvailable ? 'mongo' : 'memory'
  });
});

app.get('/api/projects', async (req, res) => {
  try {
    if (!isMongoAvailable) {
      const projects = [...memoryStore.projects].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return successResponse(res, projects);
    }
    const projects = await Project.find().sort({ createdAt: -1 });
    return successResponse(res, projects);
  } catch (err) {
    return errorResponse(res, 500, 'Failed to fetch projects');
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    if (!req.body.name || !req.body.name.trim()) {
      return errorResponse(res, 400, 'Project name is required');
    }

    if (!isMongoAvailable) {
      const project = {
        _id: createMemoryId(),
        name: req.body.name.trim(),
        description: req.body.description?.trim() || '',
        createdAt: new Date().toISOString()
      };
      memoryStore.projects.push(project);
      return successResponse(res, project, 201);
    }

    const project = new Project(req.body);
    await project.save();
    return successResponse(res, project, 201);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return errorResponse(res, 400, Object.values(err.errors)[0].message);
    }
    return errorResponse(res, 400, 'Failed to create project');
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    if (!isMongoAvailable) {
      const projectIndex = memoryStore.projects.findIndex(project => project._id === req.params.id);
      if (projectIndex === -1) {
        return errorResponse(res, 404, 'Project not found');
      }
      memoryStore.projects.splice(projectIndex, 1);
      memoryStore.tasks = memoryStore.tasks.filter(task => task.project !== req.params.id);
      return successResponse(res, { message: 'Project deleted' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, 400, 'Invalid project ID');
    }
    const project = await Project.findById(req.params.id);
    if (!project) {
      return errorResponse(res, 404, 'Project not found');
    }
    await Task.deleteMany({ project: req.params.id });
    await Project.findByIdAndDelete(req.params.id);
    return successResponse(res, { message: 'Project deleted' });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to delete project');
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    const { projectId } = req.query;

    if (!isMongoAvailable) {
      const tasks = memoryStore.tasks
        .filter(task => (projectId ? task.project === projectId : true))
        .map(task => ({
          ...task,
          project: memoryStore.projects.find(project => project._id === task.project) || null
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return successResponse(res, tasks);
    }

    const filter = projectId ? { project: projectId } : {};
    const tasks = await Task.find(filter).populate('project').sort({ createdAt: -1 });
    return successResponse(res, tasks);
  } catch (err) {
    return errorResponse(res, 500, 'Failed to fetch tasks');
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    if (!req.body.title || !req.body.title.trim()) {
      return errorResponse(res, 400, 'Task title is required');
    }

    if (!isMongoAvailable) {
      const allowedStatuses = ['todo', 'in-progress', 'done'];
      const allowedPriorities = ['low', 'medium', 'high'];
      const status = req.body.status || 'todo';
      const priority = req.body.priority || 'medium';

      if (!allowedStatuses.includes(status)) {
        return errorResponse(res, 400, 'Invalid status');
      }
      if (!allowedPriorities.includes(priority)) {
        return errorResponse(res, 400, 'Invalid priority');
      }
      if (req.body.project && !memoryStore.projects.some(project => project._id === req.body.project)) {
        return errorResponse(res, 400, 'Project not found');
      }

      const task = {
        _id: createMemoryId(),
        title: req.body.title.trim(),
        description: req.body.description?.trim() || '',
        status,
        priority,
        dueDate: req.body.dueDate || null,
        project: req.body.project || null,
        createdAt: new Date().toISOString()
      };
      memoryStore.tasks.push(task);

      const responseTask = {
        ...task,
        project: memoryStore.projects.find(project => project._id === task.project) || null
      };

      return successResponse(res, responseTask, 201);
    }

    if (req.body.project) {
      if (!mongoose.Types.ObjectId.isValid(req.body.project)) {
        return errorResponse(res, 400, 'Invalid project ID');
      }
      const existingProject = await Project.findById(req.body.project);
      if (!existingProject) {
        return errorResponse(res, 400, 'Project not found');
      }
    }

    const task = new Task(req.body);
    await task.save();
    const populatedTask = await Task.findById(task._id).populate('project');
    return successResponse(res, populatedTask, 201);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return errorResponse(res, 400, Object.values(err.errors)[0].message);
    }
    return errorResponse(res, 400, 'Failed to create task');
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    if (!isMongoAvailable) {
      const task = memoryStore.tasks.find(item => item._id === req.params.id);
      if (!task) {
        return errorResponse(res, 404, 'Task not found');
      }

      const allowedStatuses = ['todo', 'in-progress', 'done'];
      const allowedPriorities = ['low', 'medium', 'high'];

      if (req.body.status && !allowedStatuses.includes(req.body.status)) {
        return errorResponse(res, 400, 'Invalid status');
      }
      if (req.body.priority && !allowedPriorities.includes(req.body.priority)) {
        return errorResponse(res, 400, 'Invalid priority');
      }
      if (req.body.project && !memoryStore.projects.some(project => project._id === req.body.project)) {
        return errorResponse(res, 400, 'Project not found');
      }

      const updatedTask = {
        ...task,
        ...req.body,
        title: req.body.title !== undefined ? req.body.title.trim() : task.title,
        description: req.body.description !== undefined ? req.body.description.trim() : task.description
      };

      const taskIndex = memoryStore.tasks.findIndex(item => item._id === req.params.id);
      memoryStore.tasks[taskIndex] = updatedTask;

      return successResponse(res, {
        ...updatedTask,
        project: memoryStore.projects.find(project => project._id === updatedTask.project) || null
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, 400, 'Invalid task ID');
    }

    if (req.body.project) {
      if (!mongoose.Types.ObjectId.isValid(req.body.project)) {
        return errorResponse(res, 400, 'Invalid project ID');
      }
      const existingProject = await Project.findById(req.body.project);
      if (!existingProject) {
        return errorResponse(res, 400, 'Project not found');
      }
    }

    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate('project');
    if (!task) {
      return errorResponse(res, 404, 'Task not found');
    }
    return successResponse(res, task);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return errorResponse(res, 400, Object.values(err.errors)[0].message);
    }
    return errorResponse(res, 400, 'Failed to update task');
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    if (!isMongoAvailable) {
      const taskIndex = memoryStore.tasks.findIndex(task => task._id === req.params.id);
      if (taskIndex === -1) {
        return errorResponse(res, 404, 'Task not found');
      }
      memoryStore.tasks.splice(taskIndex, 1);
      return successResponse(res, { message: 'Task deleted' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, 400, 'Invalid task ID');
    }
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return errorResponse(res, 404, 'Task not found');
    }
    return successResponse(res, { message: 'Task deleted' });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to delete task');
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  return errorResponse(res, 500, 'Internal server error');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
