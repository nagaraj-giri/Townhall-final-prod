
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from './authService';
import { dataService } from './services/dataService';
import { useApp } from '../App';
import { useNavigate } from 'react-router-dom';

interface LoginProps {
  onLogin: (user: User) => void;
}

const FALLBACK_LOGO = 'https://i.postimg.cc/mD8z7DqZ/townhall-logo.png';

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');
  const [logoUrl, setLogoUrl] = useState(FALLBACK_LOGO);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const settings = await dataService.getSettings();
        if (settings && settings.logo) {
          setLogoUrl(settings.logo);
        }
      } catch (err) {
        console.warn("[Login] Failed to fetch custom branding:", err);
      }
    };
    fetchLogo();
  }, []);

  const handleAuthError = (err: any) => {
    const code = err.code || '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      setError('Invalid email or password. If you haven\'t joined yet, please use the Join tab.');
    } else if (code === 'auth/email-already-in-use') {
      setError('This email is already registered. Please sign in instead.');
    } else if (code === 'auth/weak-password') {
      setError('Password should be at least 6 characters.');
    } else {
      setError('Connection error. Please check your internet and try again.');
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setError('');
    setIsLoading(true);
    try {
      const user = await authService.signIn(email, password);
      if (user) onLogin(user);
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Enter your email address to receive a reset link.');
      return;
    }
    setError('');
    setIsResetting(true);
    try {
      await authService.resetPassword(email);
      showToast("Reset link sent to your inbox", "success");
    } catch (err: any) {
      setError('Unable to send reset link. Verify the email address.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setIsLoading(true);
    try {
      const user = await authService.signInWithGoogle();
      if (user) onLogin(user);
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute top-[-5%] left-[-10%] w-[200px] h-[200px] bg-white/40 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="relative z-10 max-w-sm w-full space-y-8 flex flex-col items-center">
        <div className="text-center space-y-2">
          <div className="w-24 h-24 bg-white/50 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto shadow-soft mb-4 border border-white/40 p-2 overflow-hidden">
             <img 
               src={logoUrl} 
               className="w-full h-full object-contain" 
               alt="Town Hall Logo" 
               onError={(e) => {
                 if (e.currentTarget.src !== FALLBACK_LOGO) {
                   e.currentTarget.src = FALLBACK_LOGO;
                 }
               }} 
             />
          </div>
          <h1 className="text-[28px] font-[900] text-text-dark tracking-tighter leading-none uppercase">Townhall</h1>
          <p className="text-[10px] font-bold text-text-light uppercase tracking-[0.25em]">Premium UAE Marketplace</p>
        </div>

        <div className="w-full bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-2xl shadow-black/[0.03] border border-white flex flex-col items-center">
          <div className="flex bg-gray-100/50 p-1.5 rounded-full mb-8 w-full border border-border-light shadow-inner">
            <button 
              onClick={() => { setActiveTab('signin'); setError(''); }}
              className={`flex-1 py-3.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'signin' ? 'bg-white text-text-dark shadow-sm' : 'text-text-light'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => { setActiveTab('signup'); setError(''); }}
              className={`flex-1 py-3.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'signup' ? 'bg-white text-text-dark shadow-sm' : 'text-text-light'}`}
            >
              Join
            </button>
          </div>

          {error && (
            <div className="w-full mb-6 bg-red-50 text-red-600 text-[11px] font-bold py-3.5 px-5 rounded-2xl border border-red-100 text-center animate-in fade-in slide-in-from-top-1 uppercase tracking-tight">
              {error}
            </div>
          )}

          {activeTab === 'signin' ? (
            <div className="w-full space-y-6">
              <form onSubmit={handleEmailSignIn} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                  <input 
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-[14px] font-bold text-text-dark focus:ring-1 focus:ring-primary outline-none shadow-inner"
                    placeholder="name@example.ae"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-[14px] font-bold text-text-dark focus:ring-1 focus:ring-primary outline-none pr-14 shadow-inner"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors focus:outline-none"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>
                <div className="flex justify-center py-1">
                  <button 
                    type="button" 
                    onClick={handleForgotPassword}
                    disabled={isResetting}
                    className="text-[10px] font-black text-gray-400 hover:text-primary transition-all uppercase tracking-widest flex items-center gap-2"
                  >
                    {isResetting && <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin"></div>}
                    Forgot Password?
                  </button>
                </div>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary text-white py-4.5 rounded-full font-black uppercase tracking-[0.2em] text-[12px] shadow-btn-glow active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center min-h-[56px]"
                >
                  {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Secure Access'}
                </button>
              </form>

              <div className="relative flex items-center justify-center py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border-light"></div></div>
                <span className="relative bg-white px-4 text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">Social Connect</span>
              </div>

              <button 
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full bg-white border border-gray-200 text-text-dark py-4 rounded-full font-bold text-[13px] flex items-center justify-center gap-3 hover:bg-gray-50 active:scale-95 transition-all shadow-sm disabled:opacity-50"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="" />
                <span>Continue with Google</span>
              </button>
            </div>
          ) : (
            <div className="w-full space-y-6 py-4 flex flex-col items-center">
              <div className="text-center space-y-4 mb-4">
                <div className="w-16 h-16 bg-primary/5 rounded-[1.5rem] flex items-center justify-center mx-auto text-primary">
                  <span className="material-symbols-outlined text-3xl font-black">how_to_reg</span>
                </div>
                <div className="space-y-2 px-2">
                  <h3 className="text-sm font-black text-text-dark uppercase tracking-tight">One-Click Membership</h3>
                  <p className="text-[12px] text-text-light font-medium leading-relaxed">Join our verified UAE marketplace instantly using your Google account.</p>
                </div>
              </div>

              <button 
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full bg-white border border-gray-200 text-text-dark py-5 rounded-full font-black uppercase tracking-[0.1em] text-[13px] shadow-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 min-h-[60px]"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="" />
                    <span>Join with Google</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
        
        <div className="flex flex-col items-center gap-3 pt-2">
           <button 
            onClick={() => navigate('/join-expert')}
            className="text-[11px] font-black text-primary uppercase tracking-[0.15em] border-b-2 border-primary/20 pb-0.5 hover:border-primary transition-all"
           >
             Register as Service Provider
           </button>
           <p className="text-center text-[9px] font-bold text-text-light leading-relaxed uppercase tracking-widest opacity-60">
            Secure enterprise infrastructure • Dubai, UAE
           </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
