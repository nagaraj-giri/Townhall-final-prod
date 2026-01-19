import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../types';

interface ProviderDashboardProps {
  user: User;
}

type BidStatus = 'Active' | 'Pending' | 'Accepted';

const ProviderDashboard: React.FC<ProviderDashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<BidStatus>('Active');

  const bids = [
    {
      id: 'b1',
      title: 'Dubai Luxury Trip',
      subtitle: 'Family Holiday • 2 Adults, 1 Child',
      category: 'Travel & Tours',
      icon: 'flight',
      iconBg: 'bg-[#FFF9E5]',
      iconColor: 'text-[#FFB100]',
      amount: 'AED 12,000',
      timingLabel: 'EXPIRES IN',
      timingValue: '4h 32m',
      status: 'Active',
      statusBg: 'bg-[#F0F9EB]',
      statusColor: 'text-[#8BC34A]',
      providerImg: 'https://i.pravatar.cc/100?u=p1'
    },
    {
      id: 'b2',
      title: 'Golden Visa Processing',
      subtitle: 'Investor Visa • Urgent',
      category: 'Visa Services',
      icon: 'verified',
      iconBg: 'bg-[#F0F9EB]',
      iconColor: 'text-[#8BC34A]',
      amount: 'AED 5,200',
      timingLabel: 'SUBMITTED',
      timingValue: 'Yesterday',
      status: 'Accepted',
      statusBg: 'bg-[#F0F9EB]',
      statusColor: 'text-[#8BC34A]',
      hasChat: true
    },
    {
      id: 'b3',
      title: 'Company Setup - Freezone',
      subtitle: 'New Startup • 3 Visas',
      category: 'Business Setup',
      icon: 'corporate_fare',
      iconBg: 'bg-[#F2F0F9]',
      iconColor: 'text-primary',
      amount: 'AED 18,500',
      timingLabel: 'EXPIRES IN',
      timingValue: '12h 00m',
      status: 'Pending',
      statusBg: 'bg-[#FFF4D8]',
      statusColor: 'text-[#FFB100]',
    }
  ];

  return (
    <div className="flex flex-col min-h-screen pb-24 bg-[#FAF9F6]">
      <header className="px-6 pt-10 pb-4 flex justify-between items-center">
        <button className="text-text-dark">
          <span className="material-symbols-outlined text-2xl font-bold">grid_view</span>
        </button>
        <h1 className="text-xl font-bold text-text-dark">My Bids</h1>
        <div className="relative">
          <span className="material-symbols-outlined text-2xl text-text-dark">notifications</span>
          <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#FFD60A] border-2 border-[#FAF9F6] rounded-full"></div>
        </div>
      </header>

      <main className="flex-1 px-6 space-y-6 overflow-y-auto no-scrollbar pt-2">
        <div className="bg-white rounded-[2rem] p-6 shadow-soft flex items-center justify-between border border-gray-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#F2F0F9] rounded-full flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-xl">assignment_turned_in</span>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total Quotes Submitted</p>
              <p className="text-xl font-bold text-text-dark">156</p>
            </div>
          </div>
          <div className="h-10 w-[1px] bg-gray-100 mx-2"></div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Success</p>
            <p className="text-xl font-bold text-[#8BC34A]">34%</p>
          </div>
        </div>

        <div className="flex gap-3 justify-between">
          {(['Active', 'Pending', 'Accepted'] as BidStatus[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3.5 rounded-[1.2rem] text-xs font-bold transition-all ${
                activeTab === tab
                  ? 'bg-primary text-white shadow-lg shadow-purple-100'
                  : 'bg-white text-gray-400 border border-gray-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="space-y-5">
          {bids.filter(b => activeTab === 'Active' ? true : b.status === activeTab).map((bid) => (
            <div 
              key={bid.id} 
              onClick={() => navigate(`/rfq/${bid.id}`)}
              className="bg-white rounded-[2.2rem] p-6 shadow-card border border-gray-50 relative overflow-hidden group transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 ${bid.iconBg} rounded-full flex items-center justify-center ${bid.iconColor}`}>
                    <span className="material-symbols-outlined text-2xl">{bid.icon}</span>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-text-dark leading-tight">{bid.title}</h2>
                    <p className="text-[11px] text-gray-400 font-medium mt-0.5">{bid.subtitle}</p>
                  </div>
                </div>
                <div className={`px-4 py-1.5 ${bid.statusBg} ${bid.statusColor} text-[10px] font-bold rounded-xl`}>
                  {bid.status}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4 border-b border-gray-50 mb-4">
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Quote Amount</p>
                  <p className="text-lg font-bold text-primary">{bid.amount}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{bid.timingLabel}</p>
                  <p className="text-base font-bold text-text-dark">{bid.timingValue}</p>
                </div>
              </div>

              {bid.hasChat ? (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/chat/u1`);
                  }}
                  className="w-full bg-[#8BC34A] text-white py-4 rounded-[1.2rem] flex items-center justify-center gap-2 font-bold text-xs shadow-lg shadow-green-100 transition-transform active:scale-95"
                >
                  <span className="material-symbols-outlined text-lg">chat_bubble</span>
                  Start Chat
                </button>
              ) : (
                <div className="flex justify-between items-center">
                  <div className="flex items-center -space-x-1">
                    {bid.providerImg && (
                      <div className="relative">
                        <img src={bid.providerImg} className="w-8 h-8 rounded-full border-2 border-white object-cover shadow-sm" alt="provider" />
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-xs">
                          <span className="material-symbols-outlined text-[10px] text-primary">smart_toy</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-primary text-xs font-bold">
                    View Details
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-border-light pb-6 pt-2 px-6 flex justify-between items-center z-50">
        <button className="flex flex-col items-center gap-1 text-primary">
          <div className="bg-primary/10 p-1.5 rounded-xl">
            <span className="material-symbols-outlined">dashboard</span>
          </div>
          <span className="text-[10px] font-bold">Leads</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-text-light hover:text-primary transition-colors">
          <span className="material-symbols-outlined">payments</span>
          <span className="text-[10px] font-medium">Earnings</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-text-light hover:text-primary transition-colors">
          <span className="material-symbols-outlined">reviews</span>
          <span className="text-[10px] font-medium">Reviews</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex flex-col items-center gap-1 text-text-light hover:text-primary transition-colors">
          <span className="material-symbols-outlined">settings</span>
          <span className="text-[10px] font-medium">Settings</span>
        </button>
      </nav>
    </div>
  );
};

export default ProviderDashboard;