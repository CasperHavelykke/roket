import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
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
import OfflineBanner from './components/OfflineBanner';
import ProfileSetup from './features/profile/ProfileSetup';
import ChildSafety from './features/legal/ChildSafety';
import CommunityGuidelines from './features/legal/CommunityGuidelines';
import PrivacyPolicy from './features/legal/PrivacyPolicy';
import TermsConditions from './features/legal/TermsConditions';

function AuthGuard({ user, setupComplete, children }: { user: User | null; setupComplete: boolean; children: React.ReactNode }) {
  if (!user) return <Navigate to="/login" />;
  if (!setupComplete) return <Navigate to="/welcome" />;
  return <>{children}</>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid));
        const data = snap.data();
        setSetupComplete(!snap.exists() ? false : (data?.setupComplete === true || !!data?.gender));
      } else {
        setSetupComplete(true);
      }
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="loading">Indlæser...</div>;

  return (
    <BrowserRouter>
      <OfflineBanner />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={<AuthGuard user={user} setupComplete={setupComplete}><Home /></AuthGuard>} />
        <Route path="/chats" element={<AuthGuard user={user} setupComplete={setupComplete}><ChatsList /></AuthGuard>} />
        <Route path="/chat/:chatId" element={<AuthGuard user={user} setupComplete={setupComplete}><Chat /></AuthGuard>} />
        <Route path="/profile/me" element={<AuthGuard user={user} setupComplete={setupComplete}><MyProfile /></AuthGuard>} />
        <Route path="/profile/edit" element={<AuthGuard user={user} setupComplete={setupComplete}><EditProfile /></AuthGuard>} />
        <Route path="/profile/:userId" element={<AuthGuard user={user} setupComplete={setupComplete}><Profile /></AuthGuard>} />
        <Route path="/settings" element={<AuthGuard user={user} setupComplete={setupComplete}><Settings /></AuthGuard>} />
        <Route path="/settings/blocked" element={<AuthGuard user={user} setupComplete={setupComplete}><BlockedUsers /></AuthGuard>} />
        <Route path="/settings/feedback" element={<AuthGuard user={user} setupComplete={setupComplete}><Feedback /></AuthGuard>} />
        <Route path="/settings/delete" element={<AuthGuard user={user} setupComplete={setupComplete}><DeleteAccount /></AuthGuard>} />
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
