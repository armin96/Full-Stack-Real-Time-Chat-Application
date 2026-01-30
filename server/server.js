const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
// افزایش محدودیت حجم برای دریافت تصاویر و ویدیوهای Base64
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const mongoURI = "mongodb+srv://blackde605_db_user:wnhdvPy9VEzaGU81@cluster0chat.g5gyvvv.mongodb.net/whatsapp_clone";

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Connected to MongoDB Atlas"))
    .catch(err => console.error("❌ Connection error:", err));

// مدل کاربر
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    displayName: String,
    avatar: String,
    lastSeen: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// مدل پیام
const messageSchema = new mongoose.Schema({
    senderId: String,
    receiverId: String,
    content: String, // این فیلد شامل متن یا رشته Base64 عکس/فیلم است
    type: { type: String, default: 'text' },
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

const userSockets = {};  
const lastSeenData = {}; 

// مسیرهای API
app.post('/register', async (req, res) => {
    try {
        const { username, password, displayName } = req.body;
        const user = new User({ username, password, displayName, avatar: '' });
        await user.save();
        res.json(user);
    } catch (err) { res.status(400).send("Error"); }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (user) res.json(user);
    else res.status(401).send("Error");
});

app.get('/my-chats/:userId', async (req, res) => {
    const users = await User.find({ _id: { $ne: req.params.userId } });
    res.json(users);
});

app.get('/messages/:userId/:otherId', async (req, res) => {
    const { userId, otherId } = req.params;
    try {
        const messages = await Message.find({
            $or: [
                { senderId: userId, receiverId: otherId },
                { senderId: otherId, receiverId: userId }
            ]
        }).sort({ timestamp: 1 });
        res.json(messages);
    } catch (err) { res.json([]); }
});

// سوکت (Socket.io)
io.on('connection', (socket) => {
    socket.on('register_socket', (userId) => {
        userSockets[userId] = socket.id;
        lastSeenData[userId] = "online";
        io.emit('user_status_change', { userId, status: "online" });
    });

    socket.on('private_message', async (data) => {
        try {
            // ۱. ساخت پیام جدید با در نظر گرفتن نوع (Type)
            const newMessage = new Message({
                senderId: data.senderId,
                receiverId: data.receiverId,
                content: data.content,
                type: data.type || 'text', // دریافت نوع از اندروید یا وب
                timestamp: new Date()
            });

            // ۲. ذخیره در دیتابیس
            const savedMessage = await newMessage.save();

            // ۳. پیدا کردن سوکت گیرنده
            const receiverSocketId = userSockets[data.receiverId];
            
            if (receiverSocketId) {
                // ارسال کل آبجکت ذخیره شده به گیرنده (شامل فیلد type)
                io.to(receiverSocketId).emit('receive_message', savedMessage);
            }
        } catch (error) {
            console.error("Socket Error:", error);
        }
    });

    socket.on('disconnect', () => {
        const userId = Object.keys(userSockets).find(key => userSockets[key] === socket.id);
        if (userId) {
            const now = new Date();
            lastSeenData[userId] = now;
            delete userSockets[userId];
            io.emit('user_status_change', { userId, status: now });
        }
    });
});

// استفاده از '0.0.0.0' برای دسترسی گوشی به سرور
server.listen(3000, '0.0.0.0', () => console.log(`🚀 Server running on 3000`));