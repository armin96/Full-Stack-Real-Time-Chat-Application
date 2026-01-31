# Full-Stack-Real-Time-Chat-Application
![piccc](https://github.com/user-attachments/assets/8494d55f-6ad6-4c10-89c6-0bd674f1aec9)


<center>
  <h1>📱 Full-Stack Real-Time Chat Application</h1>
  <p><strong>A high-performance real-time messaging platform built with React, Node.js, and WebRTC. This project features instant messaging, multimedia sharing, and high-quality video/audio calling.</strong></p>
</center>

<br>



## 🚀 Key Technical Features

### 1. Real-Time Messaging (Socket.io)
* **Instant Sync**: Bidirectional message delivery with sub-100ms latency.
* **Presence Tracking**: Real-time Online/Offline status and "Last Seen" timestamps.
* **Optimistic UI**: Messages render instantly for a seamless user experience.

<br>

### 2. Live Video & Audio Calls (Agora SDK)
* **WebRTC Integration**: Ultra-low latency P2P calling powered by **Agora RTC**.
* **Signaling**: Custom socket-based call invitations and "ringing" notifications.
* **Media Management**: Advanced handling of camera/microphone permissions and stream cleanup.

<br>

### 3. Smart Multimedia Engine
* **Content Detection**: Regex-based "Big Emoji" rendering for emoji-only messages.
* **File Processing**: Support for Images, Videos, Audio (Voice messages), and PDF attachments using the `FileReader` API.

<br>

### 4. Dynamic Theme Engine
* **10+ Custom Themes**: Switch between Luxury Gold, Cyberpunk, Deep Forest, and classic WhatsApp styles instantly.
* **Persistence**: User preferences and sessions are cached via `LocalStorage`.

<br>

## 🛠 Tech Stack

<center>
  <b>Frontend:</b> React.js, Tailwind CSS, Lucide Icons <br>
  <b>Backend:</b> Node.js, Express.js <br>
  <b>Communication:</b> Socket.io (WebSockets) <br>
  <b>Video/Voice:</b> Agora RTC SDK (WebRTC) <br>
  <b>Database:</b> MongoDB Atlas (Cloud)
</center>

<br>

## ⚙️ Quick Start

1. **Clone & Install**:
   ```bash
   git clone [https://github.com/yourusername/chat-suite.git](https://github.com/yourusername/chat-suite.git)
   npm install && cd backend && npm install
