import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import driveDeskLogo from './assets/drive-desk.png';
import { auth, db } from './firebase';

function Login({ initialMode = 'login', onBack }) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  async function handleAuth(selectedMode) {
    try {
      setMode(selectedMode);
      setBusy(true);
      setError('');
      setMessage('');

      if (!email || !password || (selectedMode === 'signup' && !name)) {
        setError('Fill in all required fields.');
        return;
      }

      if (selectedMode === 'signup') {
        const accountName = name.trim();
        const credentials = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credentials.user, { displayName: accountName });
        await setDoc(
          doc(db, 'users', credentials.user.uid),
          {
            name: accountName,
            email,
            role: 'user',
            createdAt: serverTimestamp()
          },
          { merge: true }
        );

        setMessage('Account created. You are now signed in as a user.');
        return;
      }

      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-lockup auth-logo-lockup">
          <img src={driveDeskLogo} alt="DriveDesk logo" className="brand-logo" />
          <p className="marketing-logo">DriveDesk</p>
        </div>
        <h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
        <p className="auth-subtext">
          {mode === 'login'
            ? 'Login with your email and password.'
            : 'Create your account to start booking cars.'}
        </p>

        {error && <p className="status error">{error}</p>}
        {message && <p className="status success">{message}</p>}

        <form className="auth-form" onSubmit={(e) => e.preventDefault()}>
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </form>
        <div className="auth-switch">
          <button
            type="button"
            className={mode === 'login' ? 'ghost auth-tab active-mode' : 'ghost auth-tab'}
            disabled={busy}
            onClick={() => handleAuth('login')}
          >
            {busy && mode === 'login' ? 'Please wait...' : 'Login'}
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'ghost auth-tab active-mode' : 'ghost auth-tab'}
            disabled={busy}
            onClick={() => handleAuth('signup')}
          >
            {busy && mode === 'signup' ? 'Please wait...' : 'Sign up'}
          </button>
        </div>
        {onBack && (
          <button type="button" className="ghost back-home" onClick={onBack}>
            Back to Site
          </button>
        )}
      </section>
    </main>
  );
}

export default Login;
