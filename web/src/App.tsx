import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import Login from './features/auth/Login';
import Home from './features/home/Home';
import Chat from './features/chat/Chat';
import ChatsList from './features/chat/ChatsList';
import Profile from './features/profile/Profile';
import Settings from './features/settings/Settings';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="loading">Indlæser...</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={user ? <Home /> : <Navigate to="/login" />} />
        <Route path="/chats" element={user ? <ChatsList /> : <Navigate to="/login" />} />
        <Route path="/chat/:chatId" element={user ? <Chat /> : <Navigate to="/login" />} />
        <Route path="/profile/:userId" element={user ? <Profile /> : <Navigate to="/login" />} />
        <Route path="/settings" element={user ? <Settings /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
