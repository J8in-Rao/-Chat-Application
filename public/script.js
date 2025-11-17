// Initialize socket connection
const socket = io();

// DOM elements
const loginScreen = document.getElementById('loginScreen');
const chatScreen = document.getElementById('chatScreen');
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const messagesContainer = document.getElementById('messages');
const roomsList = document.getElementById('roomsList');
const usersList = document.getElementById('usersList');
const currentRoomDisplay = document.getElementById('currentRoom');
const createRoomBtn = document.getElementById('createRoomBtn');
const newRoomNameInput = document.getElementById('newRoomName');
const emojiBtn = document.getElementById('emojiBtn');
const linkBtn = document.getElementById('linkBtn');

// App state
let currentUser = null;
let currentRoom = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Load available rooms
    socket.emit('getRooms');
    
    // Set up event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Login form submission
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim();
        if (username) {
            currentUser = username;
            loginScreen.classList.add('hidden');
            chatScreen.classList.remove('hidden');
        }
    });
    
    // Message form submission
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = messageInput.value.trim();
        if (message && currentRoom) {
            socket.emit('sendMessage', { text: message });
            messageInput.value = '';
        }
    });
    
    // Handle Enter key for sending and Shift+Enter for new line
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent new line
            messageForm.dispatchEvent(new Event('submit')); // Trigger form submit
        }
        // Shift+Enter will automatically create a new line without preventing default
    });
    
    // Create room button
    createRoomBtn.addEventListener('click', () => {
        const roomName = newRoomNameInput.value.trim();
        if (roomName) {
            socket.emit('createRoom', roomName);
            newRoomNameInput.value = '';
        }
    });
    
    // Emoji button
    emojiBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent the picker from closing immediately
        const emojiPicker = document.getElementById('emojiPicker');
        emojiPicker.classList.toggle('hidden');
    });
    
    // Close emoji picker when clicking elsewhere
    document.addEventListener('click', (e) => {
        const emojiPicker = document.getElementById('emojiPicker');
        const emojiBtn = document.getElementById('emojiBtn');
        
        if (!emojiPicker.contains(e.target) && !emojiBtn.contains(e.target)) {
            emojiPicker.classList.add('hidden');
        }
    });
    
    // Add event listeners to emoji options
    document.querySelectorAll('.emoji-option').forEach(emoji => {
        emoji.addEventListener('click', () => {
            insertAtCursor(messageInput, emoji.textContent);
            messageInput.focus();
            document.getElementById('emojiPicker').classList.add('hidden');
        });
    });
    
    linkBtn.addEventListener('click', () => {
        const url = prompt('Enter URL:');
        if (url) {
            insertAtCursor(messageInput, `[${url}](${url})`);
            messageInput.focus();
        }
    });
    
    // Socket event listeners
    socket.on('usernameTaken', () => {
        alert('Username is already taken in this room. Please choose another one.');
    });
    
    socket.on('loadMessages', (messages) => {
        messagesContainer.innerHTML = '';
        messages.forEach(message => {
            addMessageToDOM(message);
        });
        scrollToBottom();
    });
    
    socket.on('receiveMessage', (message) => {
        addMessageToDOM(message);
        scrollToBottom();
    });
    
    socket.on('userJoined', (data) => {
        const message = {
            id: Date.now(),
            username: 'System',
            room: data.room,
            text: `${data.username} joined the room`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        addMessageToDOM(message, true);
        scrollToBottom();
    });
    
    socket.on('userLeft', (data) => {
        const message = {
            id: Date.now(),
            username: 'System',
            room: data.room,
            text: `${data.username} left the room`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        addMessageToDOM(message, true);
        scrollToBottom();
    });
    
    socket.on('updateUsers', (users) => {
        usersList.innerHTML = '';
        
        // Sort users to put current user at the top
        const sortedUsers = [...users].sort((a, b) => {
            if (a === currentUser) return -1; // Current user first
            if (b === currentUser) return 1;
            return 0; // Keep other users in original order
        });
        
        sortedUsers.forEach(username => {
            const userItem = document.createElement('li');
            const firstLetter = username.charAt(0).toUpperCase();
            
            // Add current user class if this is the current user
            if (username === currentUser) {
                userItem.classList.add('current-user');
            }
            
            userItem.innerHTML = `
                <span class="user-avatar">${firstLetter}</span>
                ${username}
            `;
            usersList.appendChild(userItem);
        });
        
        // Update user count in header
        document.getElementById('userCount').textContent = users.length;
    });
    
    socket.on('updateRooms', (rooms) => {
        roomsList.innerHTML = '';
        rooms.forEach(room => {
            const roomItem = document.createElement('li');
            roomItem.textContent = room;
            roomItem.addEventListener('click', () => {
                // When user clicks a room, join it
                if (currentUser) {
                    socket.emit('join', { username: currentUser, room });
                    currentRoom = room;
                    currentRoomDisplay.textContent = room;
                    
                    // Update active room in UI
                    document.querySelectorAll('.rooms-list li').forEach(item => {
                        item.classList.remove('active');
                    });
                    roomItem.classList.add('active');
                }
            });
            roomsList.appendChild(roomItem);
        });
    });
    
    socket.on('roomCreated', (roomName) => {
        // The room will appear in the list after the server updates all clients
        socket.emit('getRooms');
    });
}

// Add a message to the DOM
function addMessageToDOM(message, isSystem = false) {
    const messageItem = document.createElement('li');
    messageItem.classList.add('message');
    
    if (message.username === currentUser && !isSystem) {
        messageItem.classList.add('own');
    }
    
    // Format message content with basic markdown
    const formattedContent = formatMessageContent(message.text);
    
    messageItem.innerHTML = `
        <div class="message-header">
            <span class="message-username">${message.username}</span>
            <span class="message-timestamp">${message.timestamp}</span>
        </div>
        <div class="message-content">${formattedContent}</div>
    `;
    
    messagesContainer.appendChild(messageItem);
}

// Format message content with basic markdown
function formatMessageContent(text) {
    // Convert URLs to links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    text = text.replace(urlRegex, '<a href="$1" target="_blank">$1</a>');
    
    // Convert markdown links: [text](url) -> <a href="url">text</a>
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    return text;
}

// Scroll messages container to the bottom
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Insert text at cursor position in textarea
function insertAtCursor(element, text) {
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const before = element.value.substring(0, start);
    const after = element.value.substring(end);
    
    element.value = before + text + after;
    
    // Move cursor to the end of inserted text
    element.selectionStart = start + text.length;
    element.selectionEnd = start + text.length;
}