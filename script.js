// Check if user is logged in
if (!localStorage.getItem('token')) {
    window.location.href = '/login.html';
}

const socket = new WebSocket('ws://localhost:8081');
const user = JSON.parse(localStorage.getItem('user'));
const messages = document.getElementById('messages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const userList = document.getElementById('userList');
const chatTitle = document.getElementById('chatTitle');
const autocomplete = document.getElementById('autocomplete');
let currentChat = { type: 'channel', id: 'general' };
let emojis = [];

socket.onopen = () => {
    console.log('Connected to WebSocket server');
};

socket.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    if (
        (message.type === 'message' && message.channel === currentChat.id && currentChat.type === 'channel') ||
        (message.type === 'dm' && currentChat.type === 'dm' && (message.sender === user.username || message.recipient === user.username))
    ) {
        displayMessage(message);
    }
};

// Load initial data
async function loadData() {
    const usersRes = await fetch('/users', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    const users = await usersRes.json();
    users.forEach(u => {
        if (u.username !== user.username) {
            const li = document.createElement('li');
            li.textContent = u.displayName;
            li.dataset.type = 'dm';
            li.dataset.id = u.username;
            userList.appendChild(li);
        }
    });

    const emojisRes = await fetch('/emojis');
    emojis = await emojisRes.json();

    await loadMessages();
}

// Load messages for the current chat
async function loadMessages() {
    messages.innerHTML = '';
    const url = currentChat.type === 'channel' ? '/messages' : `/dms/${user.username}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    const data = await res.json();
    data.forEach(message => {
        if (currentChat.type === 'channel' && message.channel === currentChat.id || 
            currentChat.type === 'dm' && (message.sender === currentChat.id || message.recipient === currentChat.id)) {
            displayMessage(message);
        }
    });
}

// Display a message
function displayMessage({ sender, text, channel, recipient, profilePic }) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');

    const avatarImg = document.createElement('img');
    avatarImg.classList.add('avatar');
    avatarImg.src = profilePic || '/uploads/default.png';

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('content');

    const usernameSpan = document.createElement('div');
    usernameSpan.classList.add('username');
    usernameSpan.textContent = sender;

    const textDiv = document.createElement('div');
    textDiv.classList.add('text');
    textDiv.innerHTML = parseEmojis(text);

    contentDiv.appendChild(usernameSpan);
    contentDiv.appendChild(textDiv);
    messageDiv.appendChild(avatarImg);
    messageDiv.appendChild(contentDiv);
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

// Parse emojis in text
function parseEmojis(text) {
    return text.replace(/:(\w+):/g, (match, name) => {
        const emoji = emojis.find(e => e.name === name);
        return emoji ? `<img class="emoji" src="${emoji.path}" alt="${name}">` : match;
    });
}

// Autocomplete for emojis
messageInput.addEventListener('input', () => {
    const value = messageInput.value;
    const match = value.match(/:(\w*)$/);
    if (match) {
        const query = match[1].toLowerCase();
        const suggestions = emojis.filter(e => e.name.toLowerCase().startsWith(query));
        autocomplete.innerHTML = '';
        if (suggestions.length) {
            suggestions.forEach(e => {
                const div = document.createElement('div');
                div.textContent = e.name;
                div.addEventListener('click', () => {
                    messageInput.value = value.replace(/:(\w*)$/, `:${e.name}: `);
                    autocomplete.style.display = 'none';
                });
                autocomplete.appendChild(div);
            });
            autocomplete.style.display = 'block';
        } else {
            autocomplete.style.display = 'none';
        }
    } else {
        autocomplete.style.display = 'none';
    }
});

// Handle form submission
messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (text) {
        const message = {
            type: currentChat.type === 'channel' ? 'message' : 'dm',
            sender: user.username,
            profilePic: user.profilePic,
            text,
            channel: currentChat.type === 'channel' ? currentChat.id : undefined,
            recipient: currentChat.type === 'dm' ? currentChat.id : undefined,
            timestamp: new Date().toISOString(),
        };
        socket.send(JSON.stringify(message));
        messageInput.value = '';
        autocomplete.style.display = 'none';
    }
});

// Handle chat switching
document.querySelectorAll('.sidebar li').forEach(li => {
    li.addEventListener('click', async () => {
        document.querySelectorAll('.sidebar li').forEach(l => l.classList.remove('active'));
        li.classList.add('active');
        currentChat = { type: li.dataset.type, id: li.dataset.id };
        chatTitle.textContent = li.dataset.type === 'channel' ? `# ${li.dataset.id}` : li.textContent;
        await loadMessages();
    });
});

loadData();