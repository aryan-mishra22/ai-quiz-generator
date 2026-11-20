import { useState } from 'react';
import { Bell, Check, CircleHelp, Monitor, Moon, Sun, UserRound } from 'lucide-react';
import { PageHeading } from '../components/common.jsx';

const defaultPreferences = {
  weeklySummary: true,
  quizReminders: true,
  productUpdates: false,
};

export default function Settings({ theme, setTheme }) {
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('quizai-profile');
    return saved ? JSON.parse(saved) : { name: 'Jamie Davis', email: 'jamie.davis@example.com' };
  });
  const [preferences, setPreferences] = useState(() => {
    const saved = localStorage.getItem('quizai-preferences');
    return saved ? JSON.parse(saved) : defaultPreferences;
  });
  const [savedMessage, setSavedMessage] = useState('');

  const saveProfile = (event) => {
    event.preventDefault();
    localStorage.setItem('quizai-profile', JSON.stringify(profile));
    setSavedMessage('Your profile has been saved.');
    window.setTimeout(() => setSavedMessage(''), 2600);
  };

  const togglePreference = (key) => {
    setPreferences((current) => {
      const next = { ...current, [key]: !current[key] };
      localStorage.setItem('quizai-preferences', JSON.stringify(next));
      return next;
    });
  };

  return (
    <>
      <PageHeading eyebrow="MAKE QUIZAI YOURS" title="Settings" description="Manage your profile and learning preferences." />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          <a className="active" href="#profile"><UserRound size={17} /> Profile</a>
          <a href="#appearance"><Sun size={17} /> Appearance</a>
          <a href="#notifications"><Bell size={17} /> Notifications</a>
          <a href="#preferences"><Monitor size={17} /> Preferences</a>
        </nav>
        <div className="settings-content">
          <section className="panel settings-card" id="profile">
            <div className="settings-card-heading"><span className="settings-icon"><UserRound size={18} /></span><div><h2>Profile information</h2><p>Update the details associated with your account.</p></div></div>
            <form onSubmit={saveProfile}>
              <div className="profile-edit-row"><span className="avatar profile-large">JD</span><div><strong>Profile photo</strong><small>Demo profile · Photo upload is not enabled</small></div></div>
              <div className="config-grid two">
                <label className="field-stack"><span className="field-label">Full name</span><input className="text-input" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label>
                <label className="field-stack"><span className="field-label">Email address</span><input className="text-input" type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label>
              </div>
              <div className="settings-save-row">
                {savedMessage && <span className="saved-message"><Check size={15} />{savedMessage}</span>}
                <button className="button primary" type="submit">Save changes</button>
              </div>
            </form>
          </section>

          <section className="panel settings-card" id="appearance">
            <div className="settings-card-heading"><span className="settings-icon"><Sun size={18} /></span><div><h2>Appearance</h2><p>Choose how QuizAI looks on this device.</p></div></div>
            <div className="theme-options">
              <button className={`theme-option ${theme === 'light' ? 'selected' : ''}`} onClick={() => setTheme('light')}><span className="theme-preview light-preview"><Sun size={18} /></span><span><strong>Light</strong><small>Clean and bright</small></span>{theme === 'light' && <Check size={17} />}</button>
              <button className={`theme-option ${theme === 'dark' ? 'selected' : ''}`} onClick={() => setTheme('dark')}><span className="theme-preview dark-preview"><Moon size={18} /></span><span><strong>Dark</strong><small>Easy on the eyes</small></span>{theme === 'dark' && <Check size={17} />}</button>
            </div>
          </section>

          <section className="panel settings-card" id="notifications">
            <div className="settings-card-heading"><span className="settings-icon"><Bell size={18} /></span><div><h2>Notifications</h2><p>Choose which reminders you’d like to see.</p></div></div>
            <PreferenceToggle title="Weekly learning summary" description="A recap of your study streak and progress." checked={preferences.weeklySummary} onChange={() => togglePreference('weeklySummary')} />
            <PreferenceToggle title="Quiz reminders" description="A gentle nudge to revisit a topic you’re learning." checked={preferences.quizReminders} onChange={() => togglePreference('quizReminders')} />
            <PreferenceToggle title="Product updates" description="News about new QuizAI features and improvements." checked={preferences.productUpdates} onChange={() => togglePreference('productUpdates')} />
          </section>

          <section className="help-card" id="preferences">
            <span className="help-icon"><CircleHelp size={20} /></span>
            <span><strong>Need a hand?</strong><small>We’re here to help you get the most out of your learning space.</small></span>
            <button onClick={() => window.alert('Thanks for reaching out! Support is not connected in this demo.')}>Contact support</button>
          </section>
        </div>
      </div>
    </>
  );
}

function PreferenceToggle({ title, description, checked, onChange }) {
  return (
    <div className="preference-row">
      <div><strong>{title}</strong><small>{description}</small></div>
      <button type="button" className={`switch ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} aria-label={title} onClick={onChange}><span /></button>
    </div>
  );
}
