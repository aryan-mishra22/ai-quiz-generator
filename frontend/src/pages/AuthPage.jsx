import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Sparkles, UserRound } from 'lucide-react';

export default function AuthPage({ mode, onModeChange, onSubmit, loading, notice }) {
  const isSignup = mode === 'signup';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (isSignup && name.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    if (!/^[^\s@]+@gmail\.com$/i.test(email.trim())) {
      setError('Email must end with @gmail.com.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    try {
      await onSubmit({ name: name.trim(), email: email.trim(), password });
    } catch (submitError) {
      setError(submitError.message || 'Unable to continue.');
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-showcase" aria-hidden="true">
        <div className="auth-brand"><span className="brand-mark"><Sparkles size={20} fill="currentColor" /></span><strong>Quiz<span>AI</span></strong></div>
        <div className="auth-showcase-copy">
          <span className="auth-kicker"><Sparkles size={14} /> YOUR LEARNING SPACE</span>
          <h1>Learn smarter.<br /><span>Remember longer.</span></h1>
          <p>Turn your notes and study materials into focused practice sessions.</p>
        </div>
        <div className="auth-orbit"><span><Sparkles size={38} /></span></div>
      </section>

      <section className="auth-form-side">
        <div className="auth-mobile-brand"><span className="brand-mark"><Sparkles size={18} fill="currentColor" /></span><strong>Quiz<span>AI</span></strong></div>
        <div className="auth-card">
          <span className="auth-icon">{isSignup ? <UserRound size={22} /> : <LockKeyhole size={22} />}</span>
          <h2>{isSignup ? 'Create your account' : 'Welcome back'}</h2>
          <p>{isSignup ? 'Start building quizzes and tracking your progress.' : 'Sign in to continue your learning journey.'}</p>
          {notice && <div className="auth-error" role="status">{notice}</div>}

          <form onSubmit={submit} className="auth-form">
            {isSignup && (
              <label className="auth-field">
                <span>Full name</span>
                <div><UserRound size={17} /><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Jamie Davis" autoComplete="name" /></div>
              </label>
            )}
            <label className="auth-field">
              <span>Email address</span>
              <div><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></div>
            </label>
            <label className="auth-field">
              <span>Password</span>
              <div>
                <LockKeyhole size={17} />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete={isSignup ? 'new-password' : 'current-password'} />
                <button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="button primary auth-submit" type="submit" disabled={loading}>
              {loading ? 'Please wait…' : (isSignup ? 'Create account' : 'Sign in')} <ArrowRight size={16} />
            </button>
          </form>

          <p className="auth-switch">
            {isSignup ? 'Already have an account?' : 'New to QuizAI?'}
            <button type="button" onClick={() => onModeChange(isSignup ? 'login' : 'signup')}>
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
