const express = require('express');
const WebSocket = require('ws');
const MongoClient = require('mongodb').MongoClient;
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 8080;
const mongoUrl = 'mongodb://localhost:27017'; // Replace with your MongoDB URL
const dbName = 'chatsphere';
const jwtSecret = 'your_jwt_secret'; // Replace with a secure secret

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Multer for file uploads
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});
const upload = multer({ storage });

// MongoDB connection
let db;
MongoClient.connect(mongoUrl, { useUnifiedTopology: true })
    .then(client => {
        db = client.db(dbName);
        console.log('Connected to MongoDB');
    })
    .catch(err => console.error('MongoDB connection error:', err));

// WebSocket server
const wss = new WebSocket.Server({ port: 8081 });

wss.on('connection', (ws) => {
    ws.on('message', async (data) => {
        const message = JSON.parse(data);
        if (message.type === 'message' || message.type === 'dm') {
            await db.collection(message.type === 'message' ? 'messages' : 'dms').insertOne(message);
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            });
        }
    });
});

// Routes
app.post('/signup', upload.single('profilePic'), async (req, res) => {
    const { username, displayName, password } = req.body;
    const profilePic = req.file ? `/uploads/${req.file.filename}` : '/uploads/default.png';
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.collection('users').insertOne({
            username,
            displayName,
            password: hashedPassword,
            profilePic,
        });
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: 'Username taken' });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await db.collection('users').findOne({ username });
    if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ username }, jwtSecret, { expiresIn: '1h' });
        res.json({ token, user: { username, displayName: user.displayName, profilePic: user.profilePic } });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.post('/updateProfile', upload.single('profilePic'), async (req, res) => {
    const { username, displayName } = req.body;
    const profilePic = req.file ? `/uploads/${req.file.filename}` : undefined;
    const update = { displayName };
    if (profilePic) update.profilePic = profilePic;
    await db.collection('users').updateOne({ username }, { $set: update });
    res.json({ success: true });
});

app.post('/uploadEmoji', upload.single('emoji'), async (req, res) => {
    const { emojiName } = req.body;
    const emojiPath = `/uploads/${req.file.filename}`;
    await db.collection('emojis').insertOne({ name: emojiName, path: emojiPath });
    res.json({ success: true });
});

app.get('/messages', async (req, res) => {
    const messages = await db.collection('messages').find({ type: 'message' }).toArray();
    res.json(messages);
});

app.get('/dms/:username', async (req, res) => {
    const { username } = req.params;
    const dms = await db.collection('dms').find({
        $or: [{ sender: username }, { recipient: username }],
    }).toArray();
    res.json(dms);
});

app.get('/users', async (req, res) => {
    const users = await db.collection('users').find({}, { projection: { password: 0 } }).toArray();
    res.json(users);
});

app.get('/emojis', async (req, res) => {
    const emojis = await db.collection('emojis').find().toArray();
    res.json(emojis);
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});