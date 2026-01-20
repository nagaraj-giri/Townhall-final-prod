import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from './authService';
import { dataService } from './services/dataService';
import { useApp } from '../App';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');
  const [logoUrl, setLogoUrl] = useState('https://i.postimg.cc/mD8z7DqZ/townhall-logo.png');

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const settings = await dataService.getSettings();
        if (settings && settings.logo) {
          setLogoUrl(settings.logo);
        }
      } catch (err) {
        console.error("Failed to load settings logo", err);
      }
    };
    fetchLogo();
  }, []);

  const handleAuthError = (err: any) => {
    const code = err.code || err.message || '';
    if (code.includes('auth/invalid-credential') || code.includes('auth/wrong-password') || code.includes('auth/user-not-found')) {
      setError('Invalid account details. Please verify your credentials or Join via Google.');
    } else if (code.includes('auth/too-many-requests')) {
      setError('Security delay: Too many attempts. Try again in 5 minutes.');
    } else {
      setError('Connection issue. Please check your network and try again.');
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
      setError('Enter your email above to receive a reset link.');
      return;
    }
    setError('');
    setIsResetting(true);
    try {
      await authService.resetPassword(email);
      showToast("Check your inbox for the reset link", "success");
    } catch (err: any) {
      setError('Could not process reset. Ensure the email is correct.');
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
      <div className="absolute top-[10%] right-[-5%] w-[180px] h-[180px] bg-secondary/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="relative z-10 max-w-sm w-full space-y-8 flex flex-col items-center">
        <div className="text-center space-y-2">
          <div className="w-24 h-24 bg-white/50 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto shadow-sm mb-4 border border-white/50 p-3 overflow-hidden">
             <img src={logoUrl} className="w-full h-full object-contain" alt="Logo" onError={(e) => (e.currentTarget.src = 'https://i.postimg.cc/mD8z7DqZ/townhall-logo.png')} />
          </div>
          <h1 className="text-3xl font-[900] text-text-dark tracking-tighter leading-none">Town Hall</h1>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] opacity-70">Premium UAE Marketplace</p>
        </div>

        <div className="w-full bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-2xl shadow-black/[0.03] border border-white flex flex-col items-center">
          <div className="flex bg-gray-100/50 p-1.5 rounded-full mb-8 w-full border border-gray-50 shadow-inner">
            <button 
              onClick={() => { setActiveTab('signin'); setError(''); }}
              className={`flex-1 py-3.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'signin' ? 'bg-white text-text-dark shadow-sm' : 'text-gray-400'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => { setActiveTab('signup'); setError(''); }}
              className={`flex-1 py-3.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'signup' ? 'bg-white text-text-dark shadow-sm' : 'text-gray-400'}`}
            >
              Join
            </button>
          </div>

          {error && (
            <div className="w-full mb-6 bg-red-50 text-red-600 text-[11px] font-bold py-3.5 px-5 rounded-2xl border border-red-100 text-center animate-in fade-in slide-in-from-top-1">
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
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-[13px] font-bold text-text-dark focus:ring-1 focus:ring-primary outline-none shadow-inner"
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
                      className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-[13px] font-bold text-text-dark focus:ring-1 focus:ring-primary outline-none pr-14 shadow-inner"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-primary transition-colors focus:outline-none"
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
                    className="text-[10px] font-bold text-primary hover:underline transition-all uppercase tracking-widest flex items-center gap-2"
                  >
                    {isResetting ? (
                      <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin"></div>
                    ) : null}
                    Forgot Password?
                  </button>
                </div>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-br from-primary to-[#7B5CC4] text-white py-4.5 rounded-full font-black uppercase tracking-[0.2em] text-[12px] shadow-btn-glow active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center min-h-[56px]"
                >
                  {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Secure Access'}
                </button>
              </form>

              <div className="relative flex items-center justify-center py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                <span className="relative bg-white px-4 text-[9px] font-black text-gray-300 uppercase tracking-widest">Social Connect</span>
              </div>

              <button 
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full bg-white border border-gray-100 text-text-dark py-4 rounded-full font-bold text-[13px] flex items-center justify-center gap-3 hover:bg-gray-50 active:scale-95 transition-all shadow-sm disabled:opacity-50"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="" />
                <span>Continue with Google</span>
              </button>
            </div>
          ) : (
            <div className="w-full space-y-8 flex flex-col items-center py-6">
               <div className="text-center space-y-3 px-2">
                 <div className="w-16 h-16 bg-primary/5 text-primary rounded-3xl flex items-center justify-center mx-auto mb-2">
                    <span className="material-symbols-outlined text-3xl font-black">join_full</span>
                 </div>
                 <h2 className="text-xl font-black text-text-dark tracking-tight">Create Profile</h2>
                 <p className="text-[12px] text-gray-400 font-medium leading-relaxed">
                   Join Dubai's premium network. For security and verification, new accounts must join via Google.
                 </p>
               </div>
               
               <button 
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full bg-white border border-gray-100 text-text-dark py-5 rounded-full font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-4 hover:bg-gray-50 active:scale-95 transition-all shadow-sm disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="" />
                    <span>Join with Google</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-4 justify-center opacity-40 pt-2">
                <div className="w-1.5 h-1.5 bg-accent-green rounded-full"></div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Instant • Verified • Secure</p>
              </div>
            </div>
          )}
        </div>
        
        <p className="text-center text-[10px] font-medium text-gray-400 leading-relaxed pt-2 uppercase tracking-widest opacity-60">
          Secure enterprise infrastructure <br/>
          <span className="text-primary cursor-pointer hover:underline font-bold">Terms of Service</span>
        </p>
      </div>
    </div>
  );
};

export default Login;