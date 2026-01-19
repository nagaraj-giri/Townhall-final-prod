import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { UserRole, User, RFQ } from '../../types';
import { useApp } from '../../App';
import { PlacesField } from '../../Functions/placesfield';

const phoneCodes = [
  { name: 'UAE', code: 'ae', dialCode: '+971' },
  { name: 'KSA', code: 'sa', dialCode: '+966' },
  { name: 'Qatar', code: 'qa', dialCode: '+974' },
];

const CustomerDetails: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useApp();
  const [user, setUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [editForm, setEditForm] = useState({
    name: '',
    phonePrefix: '+971',
    phoneOnly: '',
    locationName: '',
    lat: 25.2048,
    lng: 55.2708
  });

  useEffect(() => {
    const fetchData = async () => {
      if (id) {
        const u = await dataService.getUserById(id);
        if (u) {
          setUser(u);
          let prefix = '+971';
          let body = u.phone || '';
          const matched = phoneCodes.find(pc => u.phone?.startsWith(pc.dialCode));
          if (matched) { prefix = matched.dialCode; body = u.phone?.replace(prefix, '').trim() || ''; }
          
          setEditForm({
            name: u.name || '',
            phonePrefix: prefix,
            phoneOnly: body,
            locationName: u.locationName || 'Dubai, UAE',
            lat: u.location?.lat || 25.2048,
            lng: u.location?.lng || 55.2708
          });
        }
      }
    };
    fetchData();
  }, [id]);

  const handleSaveChanges = async () => {
    if (!user || !isEditing) return;
    setIsSaving(true);
    try {
      const updatedUser = { 
        ...user, 
        name: editForm.name.trim(),
        phone: `${editForm.phonePrefix} ${editForm.phoneOnly}`.trim(),
        locationName: editForm.locationName,
        location: { lat: editForm.lat, lng: editForm.lng }
      };
      await dataService.saveUser(updatedUser);
      setUser(updatedUser);
      setIsEditing(false);
      showToast("Customer profile updated", "success");
    } catch (e) {
      showToast("Update failed", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return <div className="p-20 text-center text-gray-300 uppercase tracking-widest">Syncing Customer...</div>;

  return (
    <div className="flex flex-col min-h-screen bg-transparent pb-10">
      <header className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-white/10 backdrop-blur-md z-50 border-b border-gray-100/50">
        <button onClick={() => navigate(-1)} className="text-text-dark w-10 h-10 flex items-center justify-start"><span className="material-symbols-outlined text-2xl font-bold">arrow_back</span></button>
        <h1 className="text-[17px] font-bold text-text-dark text-center flex-1">Customer Details</h1>
        <div className="w-10"></div>
      </header>

      <main className="px-6 flex-1 overflow-y-auto no-scrollbar space-y-8 pt-4 pb-10">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-28 h-28 rounded-full border-4 border-white shadow-soft overflow-hidden bg-white ring-4 ring-primary/5">
            <img src={user.avatar} className="w-full h-full object-cover" alt="" />
          </div>
          {isEditing ? (
            <input className="w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-center text-lg font-bold text-text-dark outline-none focus:ring-1 focus:ring-primary" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} />
          ) : (
            <h2 className="text-2xl font-bold text-text-dark tracking-tight">{user.name}</h2>
          )}
        </div>

        <div className="grid grid-cols-4 gap-4 px-2">
          {[
            { label: isEditing ? 'Cancel' : 'Edit', icon: isEditing ? 'close' : 'edit', onClick: () => setIsEditing(!isEditing), active: isEditing },
            { label: user.isBlocked ? 'Activate' : 'Suspend', icon: 'block', onClick: () => dataService.saveUser({...user, isBlocked: !user.isBlocked}).then(() => setUser({...user, isBlocked: !user.isBlocked})), danger: user.isBlocked },
            { label: 'Save', icon: 'save', onClick: handleSaveChanges, active: isEditing, disabled: !isEditing, loading: isSaving },
            { label: 'Delete', icon: 'delete', onClick: () => {}, danger: true },
          ].map((btn) => (
            <button key={btn.label} onClick={btn.onClick} disabled={(btn as any).disabled || (btn as any).loading} className={`flex flex-col items-center gap-2 ${((btn as any).disabled && !(btn as any).loading) ? 'opacity-30' : ''}`}>
              <div className={`w-12 h-12 bg-white rounded-2xl shadow-soft flex items-center justify-center border transition-all ${btn.active ? 'border-primary bg-primary/5' : btn.danger ? 'border-red-100 bg-red-50/20' : 'border-gray-50'}`}>
                {(btn as any).loading ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div> : <span className={`material-symbols-outlined text-[22px] ${btn.active ? 'text-primary' : btn.danger ? 'text-red-500' : 'text-text-dark'}`}>{btn.icon}</span>}
              </div>
              <span className="text-[11px] font-bold text-gray-400">{btn.label}</span>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-soft border border-white divide-y divide-gray-50 overflow-hidden">
          <div className="p-6">
            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">Email Address</p>
            <p className="text-[13px] font-bold text-text-dark">{user.email}</p>
          </div>
          <div className="p-6">
            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">Phone Number</p>
            {isEditing ? (
              <div className="flex gap-2 w-full mt-1">
                  <select className="bg-gray-50 border border-gray-100 text-xs font-bold rounded-lg px-2" value={editForm.phonePrefix} onChange={e => setEditForm({...editForm, phonePrefix: e.target.value})}>
                    {phoneCodes.map(pc => <option key={pc.code} value={pc.dialCode}>{pc.dialCode}</option>)}
                  </select>
                  <input className="flex-1 bg-gray-50 border border-gray-100 text-xs font-bold rounded-lg py-2 px-3 focus:ring-1 focus:ring-primary outline-none" value={editForm.phoneOnly} onChange={e => setEditForm({...editForm, phoneOnly: e.target.value})} />
              </div>
            ) : (
              <p className="text-[13px] font-bold text-text-dark">{user.phone || 'Not available'}</p>
            )}
          </div>
          <div className="p-6">
            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">Location</p>
            {isEditing ? (
                <div className="mt-2 pointer-events-auto min-h-[48px]">
                   <PlacesField 
                    placeholder="Search Area..."
                    onPlaceChange={(res) => {
                      setEditForm(prev => ({
                        ...prev,
                        locationName: res.name,
                        lat: res.lat,
                        lng: res.lng
                      }));
                    }}
                   />
                </div>
            ) : (
              <p className="text-[13px] font-bold text-text-dark">{user.locationName || 'Dubai, UAE'}</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CustomerDetails;