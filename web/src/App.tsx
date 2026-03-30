import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import Login from './features/auth/Login';
import Home from './features/home/Home';
import Chat from './features/chat/Chat';
import ChatsList from './features/chat/ChatsList';
import Profile from './features/profile/Profile';
import MyProfile from './features/profile/MyProfile';
import EditProfile from './features/profile/EditProfile';
import Settings from './features/settings/Settings';
import BlockedUsers from './features/settings/BlockedUsers';
import Feedback from './features/settings/Feedback';
import DeleteAccount from './features/settings/DeleteAccount';
import Welcome from './features/auth/Welcome';
import ProfileSetup from './features/profile/ProfileSetup';
import ChildSafety from './features/legal/ChildSafety';
import CommunityGuidelines from './features/legal/CommunityGuidelines';
import PrivacyPolicy from './features/legal/PrivacyPolicy';
import TermsConditions from './features/legal/TermsConditions';

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
        <Route path="/profile/me" element={user ? <MyProfile /> : <Navigate to="/login" />} />
        <Route path="/profile/edit" element={user ? <EditProfile /> : <Navigate to="/login" />} />
        <Route path="/profile/:userId" element={user ? <Profile /> : <Navigate to="/login" />} />
        <Route path="/settings" element={user ? <Settings /> : <Navigate to="/login" />} />
        <Route path="/settings/blocked" element={user ? <BlockedUsers /> : <Navigate to="/login" />} />
        <Route path="/settings/feedback" element={user ? <Feedback /> : <Navigate to="/login" />} />
        <Route path="/settings/delete" element={user ? <DeleteAccount /> : <Navigate to="/login" />} />
        <Route path="/welcome" element={user ? <Welcome /> : <Navigate to="/login" />} />
        <Route path="/profile/setup" element={user ? <ProfileSetup /> : <Navigate to="/login" />} />
        <Route path="/legal/child-safety" element={<ChildSafety />} />
        <Route path="/legal/community-guidelines" element={<CommunityGuidelines />} />
        <Route path="/legal/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/legal/terms-conditions" element={<TermsConditions />} />
      </Routes>
    </BrowserRouter>
  );
}
