import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';
import { dataService } from '../services/dataService';
import { useApp } from '../App';
import { useNavigate } from 'react-router-dom';

const FALLBACK_LOGO = 'https://i.postimg.cc/mD8z7DqZ/townhall-logo.png';

const Login: React.FC<{ onLogin: (user: User) => void }> = ({ onLogin }) => {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(FALLBACK_LOGO);

  useEffect(() => {
    dataService.getSettings().then(s => { if (s?.logo) setLogoUrl(s.logo); });
  }, []);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    
    if (!trimmedEmail || !password) {
      showToast('Please enter both email and password.', 'error');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      showToast('Please enter a valid email format.', 'error');
      return;
    }
    
    setIsLoading(true);
    try {
      const user = await authService.signIn(trimmedEmail, password);
      if (user) onLogin(user);
    } catch (err: any) {
      showToast('Invalid credentials or account suspended.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    try {
      const user = await authService.signInWithGoogle();
      if (user) {
        showToast(`Welcome, ${user.name}`, 'success');
        onLogin(user);
      }
    } catch (err: any) {
      showToast('Authentication failed.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between py-10 px-6">
      <div className="max-w-sm w-full flex flex-col items-center animate-in fade-in duration-700">
        <div className="text-center mb-8 space-y-4">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-soft p-3 overflow-hidden border border-white">
             <img src={logoUrl} className="w-full h-full object-contain" alt="Townhall" />
          </div>
          <div className="space-y-1">
            <h1 className="text-[26px] font-black text-text-dark tracking-[0.15em] uppercase">Town Hall</h1>
            <p className="text-[10px] font-normal text-text-light uppercase tracking-[0.25em] opacity-80">Premium UAE Marketplace</p>
          </div>
        </div>

        <div className="w-full bg-white rounded-[3.5rem] p-8 shadow-2xl border border-white relative">
          <div className="flex bg-[#F8F9FA] p-1.5 rounded-full mb-10 border border-gray-100">
            <button 
              onClick={() => setActiveTab('signin')} 
              className={`flex-1 py-3.5 rounded-full text-[11px] font-normal uppercase tracking-widest transition-all duration-300 ${activeTab === 'signin' ? 'bg-white text-text-dark shadow-md' : 'text-gray-400 opacity-60'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => setActiveTab('signup')} 
              className={`flex-1 py-3.5 rounded-full text-[11px] font-normal uppercase tracking-widest transition-all duration-300 ${activeTab === 'signup' ? 'bg-white text-text-dark shadow-md border border-gray-100' : 'text-gray-400 opacity-60'}`}
            >
              Join
            </button>
          </div>

          <div className="min-h-[340px] flex flex-col">
            {activeTab === 'signin' ? (
              <form onSubmit={handleEmailSignIn} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-2">
                  <label className="text-[9px] font-normal text-gray-400 uppercase tracking-[0.2em] ml-2">Email Address</label>
                  <input 
                    type="email" 
                    required 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="w-full px-6 py-4.5 bg-[#F9FAFB] border-none rounded-2xl text-[14px] font-normal text-text-dark focus:ring-1 focus:ring-primary shadow-inner" 
                    placeholder="name@example.ae" 
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-2">
                    <label className="text-[9px] font-normal text-gray-400 uppercase tracking-[0.2em]">Password</label>
                  </div>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      required 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      className="w-full px-6 py-4.5 bg-[#F9FAFB] border-none rounded-2xl text-[14px] font-normal text-text-dark focus:ring-1 focus:ring-primary shadow-inner" 
                      placeholder="••••••••" 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)} 
                      className="absolute right-5 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-xl font-light hover:text-primary transition-colors"
                    >
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isLoading} 
                  className="w-full bg-[#5B3D9D] text-white py-5 rounded-[2rem] font-normal uppercase text-[12px] tracking-[0.2em] shadow-btn-glow flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-70 mt-4"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Secure Access'
                  )}
                </button>

                <div className="relative flex items-center justify-center py-2">
                  <div className="w-full border-t border-gray-100"></div>
                </div>
                
                <button 
                  type="button"
                  onClick={handleGoogleAuth} 
                  className="w-full bg-white border border-gray-200 py-5 rounded-full font-normal text-[13px] flex items-center justify-center gap-3 shadow-soft active:scale-[0.98] transition-all hover:bg-gray-50"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="" />
                  <span className="uppercase tracking-widest text-[11px] font-normal">Continue with Google</span>
                </button>
              </form>
            ) : (
              <div className="space-y-8 text-center animate-in fade-in slide-in-from-left-4 duration-500 py-6 flex-1 flex flex-col justify-center">
                <div className="w-20 h-20 bg-[#F2F0F9] text-primary rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner">
                  <span className="material-symbols-outlined text-[32px] font-normal">how_to_reg</span>
                </div>
                <div className="space-y-3">
                  <h2 className="text-[14px] font-black text-text-dark uppercase tracking-[0.1em]">One-Click Membership</h2>
                  <p className="text-[11px] text-text-light font-normal leading-relaxed px-6 opacity-70">
                    Join our verified UAE marketplace instantly using your Google account.
                  </p>
                </div>
                <button 
                  onClick={handleGoogleAuth}
                  disabled={isLoading}
                  className="w-full bg-white border border-gray-200 py-5 rounded-full font-normal text-[12px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-soft active:scale-[0.98] transition-all hover:bg-gray-50 disabled:opacity-50 mt-4"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="" />
                  <span>JOIN WITH GOOGLE</span>
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col items-center mt-10 space-y-2 opacity-60">
          <p className="text-[9px] font-normal text-text-light uppercase tracking-[0.15em]">Secure Enterprise Infrastructure</p>
        </div>
      </div>

      <div className="w-full max-w-sm px-6">
        <button 
          onClick={() => navigate('/join-expert')} 
          className="w-full py-4 text-[11px] font-normal text-primary uppercase tracking-[0.2em] active:scale-95 transition-all text-center"
        >
          Register as Service Provider
        </button>
      </div>
    </div>
  );
};

export default Login;