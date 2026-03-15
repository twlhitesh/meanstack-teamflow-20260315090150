const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

const JWT_SECRET = process.env.JWT_SECRET || 'teamflow-dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const normalizeOrigin = (value) => {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (raw === '*') return '*';
  try {
    return new URL(raw).origin.toLowerCase();
  } catch {
    return raw.replace(/\/+$/, '').toLowerCase();
  }
};

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:4200')
  .split(',')
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedRequestOrigin = normalizeOrigin(origin);
    const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(normalizedRequestOrigin);

    if (isAllowed) {
      return callback(null, true);
    }

    return callback(null, false);
  }
}));
app.use(express.json());

let isMongoAvailable = false;
const memoryStore = {
  users: [],
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

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt
});

const issueToken = (userId) => {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const parseAuthToken = (headerValue) => {
  if (!headerValue || !headerValue.startsWith('Bearer ')) {
    return null;
  }
  return headerValue.slice(7).trim();
};

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/teamflow', {
  serverSelectionTimeoutMS: 3000
})
  .then(() => {
    isMongoAvailable = true;
    console.log('MongoDB Connected');
  })
  .catch((err) => {
    isMongoAvailable = false;
    console.log('MongoDB Connection Error:', err.message);
    console.log('Using in-memory fallback store');
  });

const userSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'], trim: true },
  email: { type: String, required: [true, 'Email is required'], trim: true, lowercase: true, unique: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const projectSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Project name is required'], trim: true },
  description: { type: String, trim: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Project = mongoose.model('Project', projectSchema);
const Task = mongoose.model('Task', taskSchema);

const requireAuth = async (req, res, next) => {
  try {
    const token = parseAuthToken(req.headers.authorization);
    if (!token) {
      return errorResponse(res, 401, 'Authentication required');
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return errorResponse(res, 401, 'Invalid or expired token');
    }

    const userId = payload.sub;
    if (!userId) {
      return errorResponse(res, 401, 'Invalid token payload');
    }

    if (!isMongoAvailable) {
      const user = memoryStore.users.find((item) => item._id === userId);
      if (!user) {
        return errorResponse(res, 401, 'User not found');
      }
      req.user = sanitizeUser(user);
      return next();
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return errorResponse(res, 401, 'Invalid token user');
    }

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 401, 'User not found');
    }

    req.user = sanitizeUser(user);
    return next();
  } catch (err) {
    return errorResponse(res, 401, 'Authentication failed');
  }
};

app.get('/api/health', (req, res) => {
  return successResponse(res, {
    status: 'ok',
    database: isMongoAvailable ? 'mongo' : 'memory'
  });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    if (!name || !email || !password) {
      return errorResponse(res, 400, 'Name, email and password are required');
    }

    if (password.length < 6) {
      return errorResponse(res, 400, 'Password must be at least 6 characters');
    }

    if (!isMongoAvailable) {
      const existing = memoryStore.users.find((user) => user.email === email);
      if (existing) {
        return errorResponse(res, 409, 'Email already registered');
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = {
        _id: createMemoryId(),
        name,
        email,
        passwordHash,
        createdAt: new Date().toISOString()
      };

      memoryStore.users.push(user);
      const token = issueToken(user._id);
      return successResponse(res, { token, user: sanitizeUser(user) }, 201);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorResponse(res, 409, 'Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ name, email, passwordHash });
    await user.save();

    const token = issueToken(user._id.toString());
    return successResponse(res, { token, user: sanitizeUser(user) }, 201);
  } catch (err) {
    return errorResponse(res, 500, 'Failed to register');
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    if (!email || !password) {
      return errorResponse(res, 400, 'Email and password are required');
    }

    if (!isMongoAvailable) {
      const user = memoryStore.users.find((item) => item.email === email);
      if (!user) {
        return errorResponse(res, 401, 'Invalid credentials');
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return errorResponse(res, 401, 'Invalid credentials');
      }

      const token = issueToken(user._id);
      return successResponse(res, { token, user: sanitizeUser(user) });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return errorResponse(res, 401, 'Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return errorResponse(res, 401, 'Invalid credentials');
    }

    const token = issueToken(user._id.toString());
    return successResponse(res, { token, user: sanitizeUser(user) });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to login');
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  return successResponse(res, req.user);
});

app.get('/api/projects', requireAuth, async (req, res) => {
  try {
    if (!isMongoAvailable) {
      const projects = memoryStore.projects
        .filter((project) => project.owner === req.user._id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return successResponse(res, projects);
    }

    const projects = await Project.find({ owner: req.user._id }).sort({ createdAt: -1 });
    return successResponse(res, projects);
  } catch (err) {
    return errorResponse(res, 500, 'Failed to fetch projects');
  }
});

app.post('/api/projects', requireAuth, async (req, res) => {
  try {
    if (!req.body.name || !req.body.name.trim()) {
      return errorResponse(res, 400, 'Project name is required');
    }

    if (!isMongoAvailable) {
      const project = {
        _id: createMemoryId(),
        name: req.body.name.trim(),
        description: req.body.description?.trim() || '',
        owner: req.user._id,
        createdAt: new Date().toISOString()
      };
      memoryStore.projects.push(project);
      return successResponse(res, project, 201);
    }

    const project = new Project({
      name: req.body.name.trim(),
      description: req.body.description?.trim() || '',
      owner: req.user._id
    });
    await project.save();
    return successResponse(res, project, 201);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return errorResponse(res, 400, Object.values(err.errors)[0].message);
    }
    return errorResponse(res, 400, 'Failed to create project');
  }
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    if (!isMongoAvailable) {
      const projectIndex = memoryStore.projects.findIndex(
        (project) => project._id === req.params.id && project.owner === req.user._id
      );

      if (projectIndex === -1) {
        return errorResponse(res, 404, 'Project not found');
      }

      const projectId = memoryStore.projects[projectIndex]._id;
      memoryStore.projects.splice(projectIndex, 1);
      memoryStore.tasks = memoryStore.tasks.filter(
        (task) => !(task.project === projectId && task.owner === req.user._id)
      );
      return successResponse(res, { message: 'Project deleted' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, 400, 'Invalid project ID');
    }

    const project = await Project.findOne({ _id: req.params.id, owner: req.user._id });
    if (!project) {
      return errorResponse(res, 404, 'Project not found');
    }

    await Task.deleteMany({ project: req.params.id, owner: req.user._id });
    await Project.findByIdAndDelete(req.params.id);
    return successResponse(res, { message: 'Project deleted' });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to delete project');
  }
});

app.get('/api/tasks', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.query;

    if (!isMongoAvailable) {
      const tasks = memoryStore.tasks
        .filter((task) => {
          if (task.owner !== req.user._id) return false;
          if (projectId) return task.project === projectId;
          return true;
        })
        .map((task) => ({
          ...task,
          project: memoryStore.projects.find(
            (project) => project._id === task.project && project.owner === req.user._id
          ) || null
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return successResponse(res, tasks);
    }

    const filter = { owner: req.user._id };
    if (projectId) {
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return errorResponse(res, 400, 'Invalid project ID');
      }
      filter.project = projectId;
    }

    const tasks = await Task.find(filter).populate('project').sort({ createdAt: -1 });
    return successResponse(res, tasks);
  } catch (err) {
    return errorResponse(res, 500, 'Failed to fetch tasks');
  }
});

app.post('/api/tasks', requireAuth, async (req, res) => {
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
      if (req.body.project && !memoryStore.projects.some(
        (project) => project._id === req.body.project && project.owner === req.user._id
      )) {
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
        owner: req.user._id,
        createdAt: new Date().toISOString()
      };

      memoryStore.tasks.push(task);

      const responseTask = {
        ...task,
        project: memoryStore.projects.find((project) => project._id === task.project) || null
      };

      return successResponse(res, responseTask, 201);
    }

    if (req.body.project) {
      if (!mongoose.Types.ObjectId.isValid(req.body.project)) {
        return errorResponse(res, 400, 'Invalid project ID');
      }

      const existingProject = await Project.findOne({ _id: req.body.project, owner: req.user._id });
      if (!existingProject) {
        return errorResponse(res, 400, 'Project not found');
      }
    }

    const task = new Task({
      title: req.body.title.trim(),
      description: req.body.description?.trim() || '',
      status: req.body.status,
      priority: req.body.priority,
      dueDate: req.body.dueDate,
      project: req.body.project || null,
      owner: req.user._id
    });

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

app.put('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    if (!isMongoAvailable) {
      const task = memoryStore.tasks.find((item) => item._id === req.params.id && item.owner === req.user._id);
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
      if (req.body.project && !memoryStore.projects.some(
        (project) => project._id === req.body.project && project.owner === req.user._id
      )) {
        return errorResponse(res, 400, 'Project not found');
      }

      const updatedTask = {
        ...task,
        ...req.body,
        title: req.body.title !== undefined ? req.body.title.trim() : task.title,
        description: req.body.description !== undefined ? req.body.description.trim() : task.description
      };

      const taskIndex = memoryStore.tasks.findIndex((item) => item._id === req.params.id && item.owner === req.user._id);
      memoryStore.tasks[taskIndex] = updatedTask;

      return successResponse(res, {
        ...updatedTask,
        project: memoryStore.projects.find((project) => project._id === updatedTask.project) || null
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, 400, 'Invalid task ID');
    }

    if (req.body.project) {
      if (!mongoose.Types.ObjectId.isValid(req.body.project)) {
        return errorResponse(res, 400, 'Invalid project ID');
      }
      const existingProject = await Project.findOne({ _id: req.body.project, owner: req.user._id });
      if (!existingProject) {
        return errorResponse(res, 400, 'Project not found');
      }
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      req.body,
      { new: true, runValidators: true }
    ).populate('project');

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

app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    if (!isMongoAvailable) {
      const taskIndex = memoryStore.tasks.findIndex((task) => task._id === req.params.id && task.owner === req.user._id);
      if (taskIndex === -1) {
        return errorResponse(res, 404, 'Task not found');
      }
      memoryStore.tasks.splice(taskIndex, 1);
      return successResponse(res, { message: 'Task deleted' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, 400, 'Invalid task ID');
    }

    const task = await Task.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
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
