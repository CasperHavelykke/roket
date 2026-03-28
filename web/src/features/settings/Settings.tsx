import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import './Settings.css';

export default function Settings() {
  return (
    <div className="page">
      <nav className="navbar">
        <Link to="/" className="back">Tilbage</Link>
        <h1>Indstillinger</h1>
      </nav>
      <div className="settings-list">
        <button className="danger-btn" onClick={() => signOut(auth)}>
          Log ud
        </button>
      </div>
    </div>
  );
}
