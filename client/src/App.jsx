import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import AgoraRTC from "agora-rtc-sdk-ng";
import EmojiPicker from 'emoji-picker-react';
import { 
  Phone, Video, Send, Paperclip, Smile, User, Moon, Sun, 
  X, LogOut, PhoneOff, Camera, Settings, Mic, Volume2, Palette, Check, MessageSquare, Clock, FileText
} from 'lucide-react';

// Socket connection and Agora configuration
const socket = io('http://localhost:3000');
const AGORA_APP_ID = "7d833f08030d4926a9f8693377e64ba8"; 
const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

// 10 Diverse Themes Definition
const themes = [
  { id: 'wa-dark', name: 'WhatsApp Dark', primary: '#00a884', bg: '#0b141a', chatBg: '#0b141a', sidebar: '#111b21', header: '#202c33', bubble: '#056162', text: '#ffffff' },
  { id: 'wa-light', name: 'WhatsApp Light', primary: '#00a884', bg: '#e5ddd5', chatBg: '#e5ddd5', sidebar: '#ffffff', header: '#f0f2f5', bubble: '#dcf8c6', text: '#000000' },
  { id: 'ocean-dark', name: 'Ocean Dark', primary: '#0077b6', bg: '#001219', chatBg: '#001219', sidebar: '#001d29', header: '#002533', bubble: '#005f73', text: '#ffffff' },
  { id: 'royal-purple', name: 'Royal Purple', primary: '#7b2cbf', bg: '#10002b', chatBg: '#10002b', sidebar: '#240046', header: '#3c096c', bubble: '#5a189a', text: '#ffffff' },
  { id: 'forest', name: 'Deep Forest', primary: '#2d6a4f', bg: '#081c15', chatBg: '#081c15', sidebar: '#1b4332', header: '#2d6a4f', bubble: '#40916c', text: '#ffffff' },
  { id: 'midnight-red', name: 'Midnight Red', primary: '#e63946', bg: '#1a1a1a', chatBg: '#1a1a1a', sidebar: '#2b2b2b', header: '#333333', bubble: '#e63946', text: '#ffffff' },
  { id: 'cyberpunk', name: 'Cyber Neon', primary: '#f72585', bg: '#0b090a', chatBg: '#0b090a', sidebar: '#161a1d', header: '#a4133c', bubble: '#ff4d6d', text: '#ffffff' },
  { id: 'luxury-gold', name: 'Luxury Gold', primary: '#d4af37', bg: '#1c1c1c', chatBg: '#1c1c1c', sidebar: '#2d2d2d', header: '#3d3d3d', bubble: '#d4af37', text: '#ffffff' },
  { id: 'soft-pink', name: 'Sakura Pink', primary: '#ff85a1', bg: '#fff0f3', chatBg: '#fff0f3', sidebar: '#ffccd5', header: '#ffb3c1', bubble: '#ff85a1', text: '#4a192c' },
  { id: 'minimal-gray', name: 'Minimal Gray', primary: '#495057', bg: '#f8f9fa', chatBg: '#f8f9fa', sidebar: '#e9ecef', header: '#dee2e6', bubble: '#adb5bd', text: '#212529' }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [formData, setFormData] = useState({ username: '', password: '', displayName: '' });
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentTheme, setCurrentTheme] = useState(themes[0]);
  const [showSettings, setShowSettings] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({}); 
  
  const [inCall, setInCall] = useState(false);
  const [localTracks, setLocalTracks] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);

  const scrollRef = useRef();
  const fileInputRef = useRef();
  const profileInputRef = useRef();
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const ringtoneRef = useRef(new Audio("https://assets.mixkit.co/active_storage/sfx/1358/1358-preview.mp3"));

  // Initial load from LocalStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('chat_user');
    if (savedUser) setUser(JSON.parse(savedUser));
    const savedThemeId = localStorage.getItem('app_theme');
    if (savedThemeId) setCurrentTheme(themes.find(t => t.id === savedThemeId) || themes[0]);
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (user) {
      socket.emit('register_socket', user._id);
      socket.emit('get_all_statuses');
      fetchChats();
      socket.on('all_statuses', (data) => setOnlineUsers(data));
      socket.on('user_status_change', (data) => setOnlineUsers(prev => ({ ...prev, [data.userId]: data.status })));
      socket.on('receive_message', (data) => {
        setActiveChat(currentActive => {
          if (currentActive && (data.senderId === currentActive._id || data.receiverId === currentActive._id)) {
            setMessages(prev => [...prev, data]);
          }
          return currentActive;
        });
      });
      socket.on('incoming_call', (data) => { 
        setIncomingCall(data); 
        ringtoneRef.current.play().catch(() => {}); 
      });
      socket.on('call_accepted', async (data) => await joinRoom(data.channelName));
      socket.on('call_ended', () => closeCallLocal());
    }
    return () => {
      socket.off('all_statuses'); socket.off('user_status_change'); socket.off('receive_message');
      socket.off('incoming_call'); socket.off('call_accepted'); socket.off('call_ended');
    };
  }, [user]);

  // Handle active chat changes
  useEffect(() => { 
    if (activeChat && user) fetchMessages(activeChat._id); 
    else setMessages([]);
  }, [activeChat]);

  // Auto-scroll to bottom
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const fetchChats = async () => {
    const res = await fetch(`http://localhost:3000/my-chats/${user._id}`);
    const data = await res.json();
    setChats(data);
  };

  const fetchMessages = async (otherId) => {
    try {
      const res = await fetch(`http://localhost:3000/messages/${user._id}/${otherId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) { console.error("Error fetching history", err); }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const res = await fetch(`http://localhost:3000/${authMode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    if (res.ok) {
      const userData = await res.json();
      setUser(userData);
      localStorage.setItem('chat_user', JSON.stringify(userData));
    }
  };

  const handleProfileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const res = await fetch('http://localhost:3000/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id, avatar: reader.result })
      });
      if (res.ok) {
        const updatedUser = await res.json();
        setUser(updatedUser);
        localStorage.setItem('chat_user', JSON.stringify(updatedUser));
      }
    };
    reader.readAsDataURL(file);
  };

  const renderAvatar = (u, size = "w-10 h-10", showBadge = false) => {
    const isOnline = onlineUsers[u?._id] === "online";
    return (
      <div className="relative flex-shrink-0">
        {u?.avatar ? (
          <img src={u.avatar} alt="p" className={`${size} rounded-full object-cover`} />
        ) : (
          <div className={`${size} bg-[#00a884] rounded-full flex items-center justify-center text-white font-bold uppercase`}>
            {u?.displayName?.[0] || '?'}
          </div>
        )}
        {showBadge && isOnline && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
        )}
      </div>
    );
  };

  const sendMessage = (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;
    const msgData = { 
      senderId: user._id, 
      receiverId: activeChat._id, 
      content: newMessage, 
      type: 'text', 
      timestamp: new Date() 
    };
    socket.emit('private_message', msgData);
    setMessages(prev => [...prev, msgData]);
    setNewMessage("");
    setShowEmoji(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileType = file.type.split('/')[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      const msgData = { 
        senderId: user._id, 
        receiverId: activeChat._id, 
        content: reader.result, 
        type: fileType, 
        fileName: file.name,
        timestamp: new Date() 
      };
      socket.emit('private_message', msgData);
      setMessages(prev => [...prev, msgData]);
    };
    reader.readAsDataURL(file);
  };

  const joinRoom = async (channelName) => {
    try {
      ringtoneRef.current.pause();
      await client.join(AGORA_APP_ID, channelName, null, user._id);
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      setLocalTracks([audioTrack, videoTrack]);
      setInCall(true);
      setTimeout(() => videoTrack.play(localVideoRef.current), 100);
      await client.publish([audioTrack, videoTrack]);
      client.on("user-published", async (remoteUser, mediaType) => {
        await client.subscribe(remoteUser, mediaType);
        if (mediaType === "video") remoteUser.videoTrack.play(remoteVideoRef.current);
        if (mediaType === "audio") remoteUser.audioTrack.play();
      });
    } catch (err) { console.error(err); }
  };

  const startCall = () => {
    if (!activeChat) return;
    const channelName = `call_${user._id.slice(-5)}_${activeChat._id.slice(-5)}`;
    socket.emit('make_call', { callerName: user.displayName, callerId: user._id, receiverId: activeChat._id, channelName });
    joinRoom(channelName);
  };

  const closeCallLocal = async () => {
    localTracks.forEach(t => { t.stop(); t.close(); });
    await client.leave();
    setInCall(false);
    setLocalTracks([]);
    ringtoneRef.current.pause();
    setIncomingCall(null);
  };

  // Helper to detect if a message is emoji-only
  const isOnlyEmoji = (str) => {
    const emojiRegex = /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])+$/g;
    return emojiRegex.test(str.replace(/\s/g, ''));
  };

  // Render content based on message type
  const renderMessageContent = (m) => {
    switch (m.type) {
      case 'image': 
        return <img src={m.content} className="rounded-lg w-full max-w-[500px] object-contain shadow-sm border border-black/10" alt="Sent Image" />;
      case 'video': 
        return <video controls className="rounded-lg w-full max-w-[500px] bg-black shadow-lg"><source src={m.content} /></video>;
      case 'audio': 
        return <audio controls className="h-10 w-full min-w-[250px]"><source src={m.content} /></audio>;
      case 'application': 
        return (
          <a href={m.content} download={m.fileName} className="flex items-center gap-3 p-3 bg-black/10 rounded-lg hover:bg-black/20 transition-all">
            <FileText size={30} className="text-white/60"/> 
            <span className="text-sm font-medium truncate max-w-[200px]">{m.fileName || 'Attachment'}</span>
          </a>
        );
      default: 
        const onlyEmoji = isOnlyEmoji(m.content);
        return (
          <p className={`${onlyEmoji ? 'text-6xl py-2' : 'text-[16px] leading-relaxed'} whitespace-pre-wrap`} dir="auto">
            {m.content}
          </p>
        );
    }
  };

  // Login/Register Screen
  if (!user) return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#111b21]">
      <div className="p-8 bg-[#202c33] rounded-xl shadow-2xl w-full max-w-md text-white text-center">
        <h2 className="text-3xl font-bold mb-8 text-[#00a884]">WhatsApp</h2>
        <form onSubmit={handleAuth} className="space-y-4">
          {authMode === 'register' && <input type="text" placeholder="Display Name" className="w-full p-3 rounded bg-[#2a3942] outline-none" onChange={e => setFormData({...formData, displayName: e.target.value})} />}
          <input type="text" placeholder="Username" className="w-full p-3 rounded bg-[#2a3942] outline-none" onChange={e => setFormData({...formData, username: e.target.value})} />
          <input type="password" placeholder="Password" className="w-full p-3 rounded bg-[#2a3942] outline-none" onChange={e => setFormData({...formData, password: e.target.value})} />
          <button className="w-full bg-[#00a884] p-3 rounded font-bold">{authMode === 'login' ? 'Login' : 'Sign Up'}</button>
        </form>
        <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="mt-4 text-[#00a884] text-xs underline">
          {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Login"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 flex overflow-hidden transition-all duration-300" style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}>
      
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 z-[600] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="p-8 rounded-3xl w-full max-w-2xl flex flex-col md:flex-row gap-8 relative shadow-2xl" style={{ backgroundColor: currentTheme.sidebar }}>
                <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4"><X/></button>
                <div className="flex-1 text-center border-r border-white/10 pr-4">
                    <h3 className="text-xl font-bold mb-6 flex items-center justify-center gap-2"><User/> Profile</h3>
                    <div className="relative w-32 h-32 mx-auto mb-4 group">
                        {renderAvatar(user, "w-full h-full text-4xl")}
                        <button onClick={() => profileInputRef.current.click()} className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all"><Camera/></button>
                        <input type="file" ref={profileInputRef} className="hidden" accept="image/*" onChange={handleProfileUpload} />
                    </div>
                    <p className="font-bold text-lg">{user.displayName}</p>
                    <button onClick={() => { localStorage.removeItem('chat_user'); setUser(null); }} className="mt-4 flex items-center gap-2 bg-red-500/20 text-red-500 px-6 py-2 rounded-full mx-auto"><LogOut size={18}/> Logout</button>
                </div>
                <div className="flex-1 pl-4 flex flex-col overflow-hidden">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Palette/> Themes</h3>
                    <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-2 custom-scrollbar" style={{maxHeight:'300px'}}>
                        {themes.map(t => (
                            <div key={t.id} onClick={() => { setCurrentTheme(t); localStorage.setItem('app_theme', t.id); }} className={`p-3 rounded-xl cursor-pointer border-2 transition-all flex items-center justify-between ${currentTheme.id === t.id ? 'border-[#00a884]' : 'border-white/10'}`} style={{ backgroundColor: t.header }}>
                                <span className="text-[10px] truncate" style={{ color: t.text }}>{t.name}</span>
                                {currentTheme.id === t.id && <Check size={14} className="text-[#00a884]"/>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Call UI */}
      {incomingCall && !inCall && (
        <div className="fixed inset-0 bg-black/95 z-[700] flex flex-col items-center justify-center text-center">
            <div className="w-32 h-32 mb-6 border-4 border-[#00a884] rounded-full p-1 animate-pulse">
                {renderAvatar({displayName: incomingCall.callerName}, "w-full h-full text-4xl")}
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{incomingCall.callerName}</h2>
            <p className="text-white/60 mb-8">Incoming Call...</p>
            <div className="flex gap-12 mt-12">
                <button onClick={() => { socket.emit('accept_call', { callerId: incomingCall.callerId, channelName: incomingCall.channelName }); setIncomingCall(null); }} className="bg-green-500 p-6 rounded-full text-white"><Phone size={32}/></button>
                <button onClick={() => { socket.emit('end_call', { receiverId: incomingCall.callerId }); setIncomingCall(null); ringtoneRef.current.pause(); }} className="bg-red-500 p-6 rounded-full text-white"><PhoneOff size={32}/></button>
            </div>
        </div>
      )}

      {inCall && (
        <div className="fixed inset-0 bg-black z-[800] flex items-center justify-center">
            <div ref={remoteVideoRef} className="w-full h-full object-cover"></div>
            <div ref={localVideoRef} className="absolute top-6 right-6 w-40 h-60 border-2 border-[#00a884] rounded-2xl overflow-hidden z-10 shadow-2xl"></div>
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20"><button onClick={() => { socket.emit('end_call', { receiverId: activeChat?._id }); closeCallLocal(); }} className="bg-red-500 p-5 rounded-full text-white"><PhoneOff size={30}/></button></div>
        </div>
      )}

      {/* Sidebar - Chat List */}
      <div className="w-[400px] flex flex-col border-r border-white/10" style={{ backgroundColor: currentTheme.sidebar }}>
        <div className="h-[60px] flex justify-between items-center px-4" style={{ backgroundColor: currentTheme.header }}>
          <div className="cursor-pointer" onClick={() => setShowSettings(true)}>{renderAvatar(user)}</div>
          <div className="flex gap-4 opacity-70"><Settings size={20} className="cursor-pointer" onClick={() => setShowSettings(true)} /><Palette size={20} className="cursor-pointer" onClick={() => setShowSettings(true)} /></div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {chats.map(c => (
            <div key={c._id} onClick={() => setActiveChat(c)} className={`flex items-center p-4 cursor-pointer transition-colors ${activeChat?._id === c._id ? 'bg-white/10 border-l-4 border-[#00a884]' : 'hover:bg-white/5'}`}>
              {renderAvatar(c, "w-12 h-12", true)}
              <div className="ml-4 flex-1">
                <div className="font-semibold">{c.displayName}</div>
                <div className="text-[10px] opacity-50">{onlineUsers[c._id] === "online" ? "Online" : "Offline"}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative" style={{ backgroundColor: currentTheme.chatBg }}>
        {activeChat ? (
          <>
            <div className="h-[65px] flex justify-between items-center px-4 border-b border-white/5" style={{ backgroundColor: currentTheme.header }}>
              <div className="flex items-center gap-3">
                {renderAvatar(activeChat, "w-10 h-10", true)}
                <div>
                    <div className="font-bold">{activeChat.displayName}</div>
                    <div className="text-[11px] opacity-60">{onlineUsers[activeChat._id] === "online" ? "Online" : "Offline"}</div>
                </div>
              </div>
              <div className="flex gap-6 opacity-70">
                <Video className="cursor-pointer hover:text-[#00a884]" onClick={startCall} />
                <Phone className="cursor-pointer hover:text-[#00a884]" onClick={startCall} />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 relative custom-scrollbar">
                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')` }}></div>
                <div className="relative z-10 flex flex-col space-y-4">
                    {messages.map((m, i) => {
                        const onlyEmoji = m.type === 'text' && isOnlyEmoji(m.content);
                        return (
                          <div key={i} className={`flex ${m.senderId === user._id ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[85%] relative ${onlyEmoji ? 'bg-transparent shadow-none' : 'p-3 px-4 rounded-2xl shadow-lg'}`} 
                                   style={{ backgroundColor: onlyEmoji ? 'transparent' : (m.senderId === user._id ? currentTheme.bubble : currentTheme.header), color: currentTheme.text }}>
                                  {renderMessageContent(m)}
                                  <div className={`text-[10px] text-right opacity-50 mt-1 flex items-center justify-end gap-1 ${onlyEmoji ? 'hidden' : ''}`}>
                                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {m.senderId === user._id && <Check size={14} className="text-blue-400" />}
                                  </div>
                              </div>
                          </div>
                        );
                    })}
                </div>
                <div ref={scrollRef} />
            </div>

            <div className="relative min-h-[85px] flex items-center gap-4 px-6 py-3" style={{ backgroundColor: currentTheme.header }}>
              {showEmoji && <div className="absolute bottom-24 left-6 z-50"><EmojiPicker onEmojiClick={(e) => setNewMessage(p => p + e.emoji)} theme={currentTheme.id.includes('dark') ? 'dark' : 'light'} /></div>}
              <Smile className="cursor-pointer hover:text-[#00a884] transition-colors" size={30} onClick={() => setShowEmoji(!showEmoji)} />
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*,audio/*,.pdf" onChange={handleFileUpload} />
              <Paperclip className="cursor-pointer opacity-70 hover:opacity-100" size={26} onClick={() => fileInputRef.current.click()} />
              <form onSubmit={sendMessage} className="flex-1 flex items-center gap-4">
                  <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 p-4 px-6 rounded-full outline-none text-[15px]" style={{ backgroundColor: currentTheme.sidebar, color: currentTheme.text }} />
                  <button type="submit" className="p-4 rounded-full text-white shadow-xl hover:scale-105 active:scale-95 transition-all" style={{ backgroundColor: currentTheme.primary }}><Send size={24} /></button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-10">
            <MessageSquare size={150}/>
            <p className="uppercase tracking-widest font-bold mt-4 text-2xl text-center">WhatsApp Web</p>
            <p className="mt-2 text-sm">Select a contact to start messaging</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.2); border-radius: 10px; }
      `}</style>
    </div>
  );
}