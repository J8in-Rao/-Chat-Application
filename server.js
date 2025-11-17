const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Store active users and rooms
const users = new Map();
const rooms = new Map();

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle socket connections
io.on('connection', (socket) => {
    console.log('New user connected:', socket.id);

    // Handle user joining with username
    socket.on('join', (data) => {
        const { username, room } = data;

        // Check if username is already taken in the room
        const existingUser = Array.from(users.values()).find(
            u => u.username === username && u.room === room
        );

        if (existingUser) {
            socket.emit('usernameTaken');
            return;
        }

        // Store user info
        users.set(socket.id, {
            id: socket.id,
            username,
            room
        });

        // Join the room
        socket.join(room);

        // Store room if it doesn't exist
        if (!rooms.has(room)) {
            rooms.set(room, []);
        }

        // Notify others in the room about the new user
        socket.to(room).emit('userJoined', { username, room });

        // Send existing messages to the new user
        const roomMessages = rooms.get(room) || [];
        socket.emit('loadMessages', roomMessages);

        // Update user list for the room
        updateUsersInRoom(room);
    });

    // Handle sending messages
    socket.on('sendMessage', (data) => {
        const user = users.get(socket.id);
        if (!user) return;

        const message = {
            id: Date.now(),
            username: user.username,
            room: user.room,
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Store message in room
        if (!rooms.has(user.room)) {
            rooms.set(user.room, []);
        }
        rooms.get(user.room).push(message);

        // Broadcast message to everyone in the room
        io.to(user.room).emit('receiveMessage', message);
    });

    // Handle creating a new room
    socket.on('createRoom', (roomName) => {
        if (!rooms.has(roomName)) {
            rooms.set(roomName, []);
            io.emit('roomCreated', roomName);
        }
    });

    // Handle getting available rooms
    socket.on('getRooms', () => {
        socket.emit('updateRooms', Array.from(rooms.keys()));
    });

    // Update user list in a room
    function updateUsersInRoom(room) {
        const usersInRoom = Array.from(users.values())
            .filter(u => u.room === room)
            .map(u => u.username);
        io.to(room).emit('updateUsers', usersInRoom);
    }

    // Handle disconnect
    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            // Remove user from the map
            users.delete(socket.id);
            
            // Notify others in the room
            socket.to(user.room).emit('userLeft', { username: user.username, room: user.room });
            
            // Update user list
            updateUsersInRoom(user.room);
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});