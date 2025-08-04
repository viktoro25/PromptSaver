const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

/*
 * Simple JSON-based backend for AI Prompt Storage.
 * Provides endpoints for user signup/login, category management, and prompt CRUD operations.
 * Data is stored in a JSON file on disk. This is a lightweight demonstration backend and
 * not intended for production use without enhancements like password hashing and authentication.
 */

const DB_FILE = './db.json';

// Initialize or load database
let db = { users: [], categories: ['MidJourney', 'Sora', 'Leonardo AI', 'VEO3', 'Other'], entries: [] };
function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(content);
    } catch (e) {
      console.error('Failed to load DB:', e);
    }
  } else {
    saveDB();
  }
}
function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

loadDB();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
// Serve static frontend from public folder
app.use(express.static('public'));

// Helper: find user by username
function findUser(username) {
  return db.users.find(u => u.username === username);
}

/* ---------------- Authentication endpoints ---------------- */
// Signup: expects { username, password }
app.post('/api/signup', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (findUser(username)) {
    return res.status(409).json({ error: 'User already exists' });
  }
  db.users.push({ username, password });
  saveDB();
  res.json({ success: true });
});

// Login: expects { username, password }
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = findUser(username);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ success: true });
});

/* ---------------- Category endpoints ---------------- */
// Get categories
app.get('/api/categories', (req, res) => {
  res.json(db.categories);
});
// Add category: { name }
app.post('/api/categories', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  if (db.categories.includes(name)) {
    return res.status(409).json({ error: 'Category exists' });
  }
  db.categories.push(name);
  saveDB();
  res.json(db.categories);
});
// Rename category
app.put('/api/categories/:oldName', (req, res) => {
  const { oldName } = req.params;
  const { newName } = req.body;
  const idx = db.categories.indexOf(oldName);
  if (idx === -1) return res.status(404).json({ error: 'Category not found' });
  if (!newName) return res.status(400).json({ error: 'newName required' });
  if (db.categories.includes(newName)) return res.status(409).json({ error: 'Category exists' });
  db.categories[idx] = newName;
  // Update entries referencing old category
  db.entries.forEach(ent => {
    if (ent.generator === oldName) ent.generator = newName;
  });
  saveDB();
  res.json(db.categories);
});
// Delete category
app.delete('/api/categories/:name', (req, res) => {
  const { name } = req.params;
  const idx = db.categories.indexOf(name);
  if (idx === -1) return res.status(404).json({ error: 'Category not found' });
  if (db.categories.length === 1) return res.status(400).json({ error: 'Cannot delete last category' });
  db.categories.splice(idx, 1);
  // Reassign entries with this category to 'Other'
  db.entries.forEach(ent => {
    if (ent.generator === name) ent.generator = 'Other';
  });
  saveDB();
  res.json(db.categories);
});

/* ---------------- Entry endpoints ---------------- */
// Get entries for a user: query param ?username=
app.get('/api/entries', (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: 'username query required' });
  const entries = db.entries.filter(e => e.user === username);
  res.json(entries);
});
// Create entry: expects { user, generator, prompt, image, tags }
app.post('/api/entries', (req, res) => {
  const { user, generator, prompt, image, tags, done } = req.body;
  if (!user || !generator || !prompt || !image) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const entry = {
    id: uuidv4(),
    user,
    generator,
    prompt,
    image,
    tags: Array.isArray(tags) ? tags : [],
    // Allow client to specify done flag or default to false
    done: typeof done === 'boolean' ? done : false
  };
  db.entries.push(entry);
  saveDB();
  res.json(entry);
});
// Update entry: /api/entries/:id expects { user, generator, prompt, image, tags }
app.put('/api/entries/:id', (req, res) => {
  const { id } = req.params;
  const entry = db.entries.find(e => e.id === id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  const { user, generator, prompt, image, tags, done } = req.body;
  if (user && entry.user !== user) return res.status(403).json({ error: 'User mismatch' });
  if (generator) entry.generator = generator;
  if (prompt) entry.prompt = prompt;
  if (image) entry.image = image;
  if (Array.isArray(tags)) entry.tags = tags;
  if (typeof done === 'boolean') entry.done = done;
  saveDB();
  res.json(entry);
});
// Delete entry
app.delete('/api/entries/:id', (req, res) => {
  const { id } = req.params;
  const idx = db.entries.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Entry not found' });
  const [removed] = db.entries.splice(idx, 1);
  saveDB();
  res.json({ success: true });
});

// Default route
app.get('*', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Prompt storage server running on port ${PORT}`);
});