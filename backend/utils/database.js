const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

// Import database utilities
const { initializeDatabase, getDatabaseStats } = require('./utils/database');

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize database
initializeDatabase().catch(error => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const stats = await getDatabaseStats();
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            database: stats
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: error.message
        });
    }
});

// Socket.IO for real-time features
const connectedUsers = new Map();
const activeStreams = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinSession', (data) => {
        socket.join(data.sessionId);
        connectedUsers.set(socket.id, {
            sessionId: data.sessionId,
            user: data.user
        });
        
        // Notify admin about user joining
        socket.to(data.sessionId).emit('userJoined', data.user);
    });

    socket.on('videoFrame', (data) => {
        // Broadcast video frame to admin in the same session
        socket.to(data.sessionId).emit('videoFrame', data);
    });

    socket.on('terminateSession', (sessionId) => {
        // Terminate session for all users
        io.to(sessionId).emit('examTerminated');
    });

    socket.on('adminMessage', (data) => {
        socket.to(data.sessionId).emit('adminMessage', data.message);
    });

    socket.on('disconnect', () => {
        const userData = connectedUsers.get(socket.id);
        if (userData) {
            socket.to(userData.sessionId).emit('userDisconnected', userData.user);
            connectedUsers.delete(socket.id);
        }
        console.log('User disconnected:', socket.id);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Server Error' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
    });
});
