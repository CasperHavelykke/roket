import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import { requestNotificationPermission, onForegroundMessage } from './services/NotificationService';
import NotificationBanner from './components/NotificationBanner';
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
import OfflineBanner from './components/OfflineBanner';
import ChildSafety from './features/legal/ChildSafety';
import CommunityGuidelines from './features/legal/CommunityGuidelines';
import PrivacyPolicy from './features/legal/PrivacyPolicy';
import TermsConditions from './features/legal/TermsConditions';

function AuthGuard({ user, children }: { user: User | null; children: React.ReactNode }) {
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        requestNotificationPermission().catch(() => {});
      }
      setUser(u);
      setLoading(false);
    });
  }, []);

  // Listen for foreground push messages
  useEffect(() => {
    if (!user) return;
    return onForegroundMessage((payload) => {
      const data = payload.data;
      if (!data) return;
      // Don't show notification if we're already in that chat
      if (window.location.pathname === `/chat/${data.chatId}`) return;
      window.dispatchEvent(new CustomEvent('roket-notification', {
        detail: {
          senderName: data.senderName || '',
          senderId: data.senderId || '',
          chatId: data.chatId || '',
          message: data.message || '',
          senderPhoto: data.senderPhoto || '',
        },
      }));
    });
  }, [user]);

  if (loading) return <div className="loading">Indlæser...</div>;

  return (
    <BrowserRouter>
      <OfflineBanner />
      <NotificationBanner />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={<AuthGuard user={user}><Home /></AuthGuard>} />
        <Route path="/chats" element={<AuthGuard user={user}><ChatsList /></AuthGuard>} />
        <Route path="/chat/:chatId" element={<AuthGuard user={user}><Chat /></AuthGuard>} />
        <Route path="/profile/me" element={<AuthGuard user={user}><MyProfile /></AuthGuard>} />
        <Route path="/profile/edit" element={<AuthGuard user={user}><EditProfile /></AuthGuard>} />
        <Route path="/profile/:userId" element={<AuthGuard user={user}><Profile /></AuthGuard>} />
        <Route path="/settings" element={<AuthGuard user={user}><Settings /></AuthGuard>} />
        <Route path="/settings/blocked" element={<AuthGuard user={user}><BlockedUsers /></AuthGuard>} />
        <Route path="/settings/feedback" element={<AuthGuard user={user}><Feedback /></AuthGuard>} />
        <Route path="/settings/delete" element={<AuthGuard user={user}><DeleteAccount /></AuthGuard>} />
        <Route path="/legal/child-safety" element={<ChildSafety />} />
        <Route path="/legal/community-guidelines" element={<CommunityGuidelines />} />
        <Route path="/legal/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/legal/terms-conditions" element={<TermsConditions />} />
      </Routes>
    </BrowserRouter>
  );
}
