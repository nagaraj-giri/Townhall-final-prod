
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { User, UserRole } from '../../types';
import ProviderDetails from './ProviderDetails';
import CustomerDetails from './CustomerDetails';

interface Props {
  adminUser: User;
}

const AdminUserDetails: React.FC<Props> = ({ adminUser }) => {
  const { id } = useParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (id) {
        const u = await dataService.getUserById(id) as User;
        setUser(u);
        setLoading(false);
      }
    };
    fetchUser();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-transparent gap-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">Opening Record...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-transparent p-10 text-center">
        <span className="material-symbols-outlined text-6xl text-gray-200 mb-4">person_search</span>
        <h2 className="text-lg font-bold text-text-dark">User Not Found</h2>
        <p className="text-[11px] text-gray-400 mt-2">The requested user account does not exist or has been removed from the system.</p>
      </div>
    );
  }

  return user.role === UserRole.PROVIDER ? (
    <ProviderDetails adminUser={adminUser} />
  ) : (
    <CustomerDetails adminUser={adminUser} />
  );
};

export default AdminUserDetails;
