import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, RFQ } from '../../types';
import { dataService } from '../services/dataService';
import { useApp } from '../../App';

interface ProfileProps {
  user: User;
  onLogout: () => void;
  onUpdateUser?: (user: User) => void;
}

const COUNTRIES = [
  { name: 'United Arab Emirates', code: 'ae', dialCode: '+971', flag: 'https://flagcdn.com/w40/ae.png' },
  { name: 'Saudi Arabia', code: 'sa', dialCode: '+966', flag: 'https://flagcdn.com/w40/sa.png' },
  { name: 'Qatar', code: 'qa', dialCode: '+974', flag: 'https://flagcdn.com/w40/qa.png' },
  { name: 'Kuwait', code: 'kw', dialCode: '+965', flag: 'https://flagcdn.com/w40/kw.png' },
  { name: 'Oman', code: 'om', dialCode: '+968', flag: 'https://flagcdn.com/w40/om.png' },
  { name: 'Bahrain', code: 'bh', dialCode: '+973', flag: 'https://flagcdn.com/w40/bh.png' },
  { name: 'India', code: 'in', dialCode: '+91', flag: 'https://flagcdn.com/w40/in.png' },
  { name: 'Pakistan', code: 'pk', dialCode: '+92', flag: 'https://flagcdn.com/w40/pk.png' },
  { name: 'United Kingdom', code: 'gb', dialCode: '+44', flag: 'https://flagcdn.com/w40/gb.png' },
  { name: 'USA', code: 'us', dialCode: '+1', flag: 'https://flagcdn.com/w40/us.png' },
];

const Profile: React.FC<ProfileProps> = ({ user, onLogout, onUpdateUser }) => {
  const navigate = useNavigate();
  const { chatUnreadCount, unreadCount, toggleNotifications, showToast } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [stats, setStats] = useState({ requests: 0, pending: 0, booked: 0 });
  const [isEditing, setIsEditing] = useState(false);
  
  const [isPhoneDropdownOpen, setIsPhoneDropdownOpen] = useState(false);
  const [isNationalityDropdownOpen, setIsNationalityDropdownOpen] = useState(false);

  // Editable local state
  const [profileData, setProfileData] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    nationality: user.nationality || 'United Arab Emirates',
    avatar: user.avatar,
    phoneDial: '+971',
    phoneFlag: 'https://flagcdn.com/w40/ae.png'
  });

  useEffect(() => {
    const fetchHistory = async () => {
      const allRfqs = await dataService.getRFQs();
      const myRfqs = allRfqs.filter(r => r.customerId === user.id);
      setRfqs(myRfqs.slice(0, 5));
      const pending = myRfqs.filter(r => r.status === 'OPEN' || r.status === 'ACTIVE').length;
      const booked = myRfqs.filter(r => r.status === 'ACCEPTED' || r.status === 'COMPLETED').length;
      setStats({ requests: myRfqs.length, pending, booked });
    };
    fetchHistory();
  }, [user.id]);

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        showToast("Updating profile picture...", "info");
        const localUrl = URL.createObjectURL(file);
        setProfileData(prev => ({ ...prev, avatar: localUrl }));
        
        const url = await dataService.uploadImage(file, `avatars/${user.id}_${Date.now()}`);
        const updatedUser = { ...user, avatar: url };
        await dataService.saveUser(updatedUser);
        if (onUpdateUser) onUpdateUser(updatedUser);
        showToast("Profile picture updated", "success");
      } catch (err) {
        showToast("Upload failed", "error");
      }
    }
  };

  const handleSaveDetails = async () => {
    try {
      const updatedUser: User = {
        ...user,
        name: profileData.name,
        email: profileData.email,
        phone: `${profileData.phoneDial} ${profileData.phone}`,
        nationality: profileData.nationality
      };
      await dataService.saveUser(updatedUser);
      if (onUpdateUser) onUpdateUser(updatedUser);
      setIsEditing(false);
      showToast("Profile details saved", "success");
    } catch (err) {
      showToast("Save failed", "error");
    }
  };

  const personalDetails = [
    { key: 'email', label: 'EMAIL ADDRESS', value: profileData.email, icon: 'mail', color: 'bg-indigo-50 text-indigo-500' },
    { key: 'phone', label: 'MOBILE NUMBER', value: profileData.phone || 'Not linked', icon: 'call', color: 'bg-green-50 text-green-500' },
    { key: 'nationality', label: 'NATIONALITY', value: profileData.nationality || 'Emirates', icon: 'flag', color: 'bg-yellow-50 text-yellow-500' },
  ];

  const currentNationalityFlag = COUNTRIES.find(c => c.name === profileData.nationality)?.flag || 'https://flagcdn.com/w40/ae.png';

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-32">
      <header className="px-6 pt-12 pb-4 flex justify-between items-center bg-transparent">
        <button onClick={() => navigate('/')} className="w-10 h-10 flex items-center justify-center bg-white rounded-2xl shadow-sm text-text-dark active:scale-95 transition-transform">
          <span className="material-symbols-outlined font-normal">grid_view</span>
        </button>
        <h1 className="text-lg font-black text-text-dark uppercase">Profile</h1>
        <button onClick={() => toggleNotifications(true)} className="relative w-11 h-11 flex items-center justify-center bg-white rounded-2xl shadow-sm text-text-dark active:scale-95 transition-transform">
          <span className="material-symbols-outlined font-normal">notifications</span>
          {unreadCount > 0 && <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent-pink rounded-full border-2 border-white shadow-sm"></div>}
        </button>
      </header>

      <main className="flex-1 px-6 space-y-8 overflow-y-auto no-scrollbar pt-2">
        {/* User Info Section */}
        <div className="flex items-center gap-5 relative">
          <div className="relative cursor-pointer" onClick={handleFileClick}>
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-soft bg-white relative">
              <img src={profileData.avatar} className="w-full h-full object-cover" alt="Profile" />
            </div>
            <div className="absolute bottom-0 right-0 bg-primary w-7 h-7 rounded-full border-2 border-white flex items-center justify-center shadow-sm text-white">
              <span className="material-symbols-outlined text-sm font-normal">photo_camera</span>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          </div>
          <div className="flex-1">
            {isEditing ? (
              <input 
                className="text-2xl font-black text-text-dark tracking-tight leading-none uppercase bg-white/50 border-none rounded-lg w-full focus:ring-0 px-0"
                value={profileData.name}
                onChange={e => setProfileData({...profileData, name: e.target.value})}
              />
            ) : (
              <h2 className="text-2xl font-black text-text-dark tracking-tight leading-none uppercase">{profileData.name}</h2>
            )}
            <p className="text-[12px] text-gray-400 font-normal mt-1">{user.locationName || 'UAE Member'}</p>
          </div>
        </div>

        {/* Circular Metrics */}
        <div className="grid grid-cols-3 gap-3 justify-items-center">
          {[
            { label: 'REQUESTS', value: stats.requests, color: 'text-primary' },
            { label: 'PENDING', value: stats.pending, color: 'text-secondary' },
            { label: 'ACCEPTED', value: stats.booked, color: 'text-accent-pink' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/80 rounded-full w-24 h-24 shadow-sm border border-white flex flex-col items-center justify-center gap-0.5">
              <p className="text-[8px] font-normal text-gray-400 uppercase tracking-widest leading-none">{stat.label}</p>
              <p className={`text-2xl font-normal ${stat.color} leading-none`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Personal Details Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-[13px] font-black text-text-dark uppercase tracking-[0.1em]">Personal Details</h3>
            <button 
              onClick={() => isEditing ? handleSaveDetails() : setIsEditing(true)} 
              className="text-[10px] font-normal text-primary uppercase tracking-widest flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">{isEditing ? 'check_circle' : 'edit'}</span>
              {isEditing ? 'SAVE' : 'EDIT'}
            </button>
          </div>
          <div className="space-y-3">
            {personalDetails.map((detail) => (
              <div key={detail.label} className="bg-white rounded-[2rem] p-5 flex flex-col shadow-card border border-white relative">
                <p className="text-[9px] font-normal text-gray-300 uppercase tracking-widest mb-1.5 ml-1">{detail.label}</p>
                
                {isEditing ? (
                  detail.key === 'phone' ? (
                    <div className="flex gap-2 w-full relative">
                      {/* Flag Select Trigger */}
                      <button 
                        onClick={() => setIsPhoneDropdownOpen(!isPhoneDropdownOpen)}
                        className="bg-gray-50 rounded-2xl px-4 py-3.5 flex items-center gap-2 shadow-inner border border-gray-100/50 active:bg-gray-100 transition-colors"
                      >
                        <img src={profileData.phoneFlag} className="w-5 h-4 object-cover rounded-[1px] shadow-sm" alt="" />
                        <span className="material-symbols-outlined text-xs text-gray-400 font-bold">expand_more</span>
                      </button>

                      {/* Phone Country Dropdown */}
                      {isPhoneDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsPhoneDropdownOpen(false)}></div>
                          <div className="absolute top-14 left-0 w-full max-w-[280px] bg-white border border-gray-100 rounded-[1.5rem] shadow-2xl z-50 p-2 max-h-60 overflow-y-auto no-scrollbar animate-in zoom-in-95 duration-200">
                            {COUNTRIES.map(c => (
                              <button 
                                key={c.code}
                                onClick={() => {
                                  setProfileData({ ...profileData, phoneDial: c.dialCode, phoneFlag: c.flag });
                                  setIsPhoneDropdownOpen(false);
                                }}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                              >
                                <img src={c.flag} className="w-5 h-4 object-cover rounded-[1px]" alt="" />
                                <span className="text-[12px] font-bold text-text-dark flex-1 text-left">{c.name}</span>
                                <span className="text-[11px] font-medium text-gray-400">{c.dialCode}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Input Group */}
                      <div className="flex-1 bg-gray-50 rounded-2xl px-5 py-3.5 flex items-center gap-3 shadow-inner border border-gray-100/50">
                        <span className="text-[13px] font-bold text-text-dark shrink-0">{profileData.phoneDial}</span>
                        <div className="w-[1px] h-4 bg-gray-200"></div>
                        <input 
                          type="tel"
                          className="bg-transparent border-none p-0 text-[13px] font-bold text-text-dark outline-none w-full focus:ring-0"
                          placeholder="50 421 1188"
                          value={profileData.phone}
                          onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : detail.key === 'nationality' ? (
                    <div className="relative w-full">
                      <button 
                        onClick={() => setIsNationalityDropdownOpen(!isNationalityDropdownOpen)}
                        className="w-full flex items-center gap-4 bg-gray-50 rounded-2xl px-5 py-3.5 shadow-inner border border-gray-100/50"
                      >
                        <img src={currentNationalityFlag} className="w-6 h-4 object-cover rounded-[1px] shadow-sm" alt="" />
                        <span className="text-[13px] font-bold text-text-dark flex-1 text-left">{profileData.nationality}</span>
                        <span className="material-symbols-outlined text-gray-400">expand_more</span>
                      </button>

                      {isNationalityDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsNationalityDropdownOpen(false)}></div>
                          <div className="absolute top-14 left-0 w-full bg-white border border-gray-100 rounded-[2rem] shadow-2xl z-50 p-2 max-h-60 overflow-y-auto no-scrollbar animate-in zoom-in-95 duration-200">
                            {COUNTRIES.map(c => (
                              <button 
                                key={c.code}
                                onClick={() => {
                                  setProfileData({ ...profileData, nationality: c.name });
                                  setIsNationalityDropdownOpen(false);
                                }}
                                className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-colors"
                              >
                                <img src={c.flag} className="w-6 h-4 object-cover rounded-[1px]" alt="" />
                                <span className="text-[13px] font-bold text-text-dark flex-1 text-left">{c.name}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <input 
                      className="text-[13px] font-normal text-text-dark tracking-tight w-full bg-gray-50 rounded-xl px-4 py-3.5 border-none focus:ring-1 focus:ring-primary shadow-inner"
                      value={detail.value}
                      onChange={(e) => setProfileData({ ...profileData, [detail.key]: e.target.value })}
                    />
                  )
                ) : (
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 ${detail.color} rounded-full flex items-center justify-center shadow-sm shrink-0`}>
                      {detail.key === 'nationality' ? (
                        <img src={currentNationalityFlag} className="w-5 h-4 object-cover rounded-[1px] shadow-sm" alt="" />
                      ) : (
                        <span className="material-symbols-outlined text-lg font-normal">{detail.icon}</span>
                      )}
                    </div>
                    <p className="text-[13px] font-bold text-text-dark tracking-tight">{detail.value}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <button onClick={onLogout} className="w-full py-5 bg-white border border-red-50 text-red-500 font-normal text-[11px] uppercase tracking-[0.3em] rounded-3xl shadow-sm active:scale-95 transition-all mt-4">
          Sign Out Session
        </button>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-gray-100 pb-10 pt-3 px-6 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.04)]">
        <button onClick={() => navigate('/')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60">
          <span className="material-symbols-outlined text-[26px] font-normal">home</span>
          <span className="text-[9px] font-normal uppercase tracking-widest">HOME</span>
        </button>
        <button onClick={() => navigate('/queries')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light opacity-60">
          <span className="material-symbols-outlined text-[26px] font-normal">format_list_bulleted</span>
          <span className="text-[9px] font-normal uppercase tracking-widest">QUERIES</span>
        </button>
        <button onClick={() => navigate('/messages')} className="flex-1 flex flex-col items-center gap-1.5 text-text-light relative opacity-60">
          <span className="material-symbols-outlined text-[26px] font-normal">chat_bubble</span>
          {chatUnreadCount > 0 && <div className="absolute top-0 right-3 w-4 h-4 bg-accent-pink rounded-full border-2 border-white text-[8px] font-normal text-white flex items-center justify-center">{chatUnreadCount > 9 ? '9+' : chatUnreadCount}</div>}
          <span className="text-[9px] font-normal uppercase tracking-widest">CHAT</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1.5 text-primary">
          <div className="bg-primary/10 w-12 h-10 flex items-center justify-center rounded-xl">
             <span className="material-symbols-outlined text-[26px] font-normal">person</span>
          </div>
          <span className="text-[9px] font-normal uppercase tracking-widest">PROFILE</span>
        </button>
      </nav>
    </div>
  );
};

export default Profile;