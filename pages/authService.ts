
import { 
  // @ts-ignore
  signInWithEmailAndPassword, 
  // @ts-ignore
  createUserWithEmailAndPassword, 
  // @ts-ignore
  signOut, 
  // @ts-ignore
  signInWithPopup, 
  // @ts-ignore
  updateProfile,
  // @ts-ignore
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from './services/firebase';
import { User, UserRole } from '../types';
import { dataService } from './services/dataService';
import { getCurrentLocation, reverseGeocode } from '../Functions/placesfield';

const captureIdentityContext = async () => {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const { ip } = await res.json();
    const device = navigator.userAgent.substring(0, 40);
    return { ip, device };
  } catch (e) {
    return { ip: 'Unknown', device: 'Web Browser' };
  }
};

const captureSignupLocation = async () => {
  try {
    const coords = await getCurrentLocation();
    const name = await reverseGeocode(coords.lat, coords.lng);
    return { lat: coords.lat, lng: coords.lng, name };
  } catch (e) {
    return { lat: 25.185, lng: 55.275, name: 'Dubai, UAE' };
  }
};

const triggerNewSignupAlerts = async (user: User) => {
  // ADMIN: In-App Alert (Bell & Toast kept)
  const allUsers = await dataService.getUsers();
  const admins = allUsers.filter(u => u.role === UserRole.ADMIN);
  
  admins.forEach(admin => {
    dataService.createNotification(
      admin.id,
      "👤 New Member Joined",
      `${user.name} has registered as a ${user.role.toLowerCase()}.`,
      "INFO",
      UserRole.ADMIN,
      `/admin/user/${user.id}`
    );
  });
};

const checkSecurityAlert = async (user: User, currentIP: string) => {
  if (user.role === UserRole.ADMIN) return;
  
  if (user.lastIP && user.lastIP !== currentIP) {
    const admins = (await dataService.getUsers()).filter(u => u.role === UserRole.ADMIN);
    
    // ADMIN: In-App Security Alert (Bell & Toast kept)
    admins.forEach(admin => {
      dataService.createNotification(
        admin.id,
        "⚠️ Identity Security Alert",
        `User ${user.name} logged in from a new IP: ${currentIP}. Previous: ${user.lastIP}`,
        "URGENT",
        UserRole.ADMIN,
        `/admin/user/${user.id}`
      );
    });
  }
};

export const authService = {
  signIn: async (email: string, password: string): Promise<User | null> => {
    if (!isFirebaseConfigured) throw new Error("Cloud Services not configured.");
    const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const firebaseUser = userCredential.user;
    const dbUser = await dataService.getUserById(firebaseUser.uid);
    const { ip, device } = await captureIdentityContext();

    if (!dbUser) {
      const locationData = await captureSignupLocation();
      const newUser: User = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || 'Marketplace User',
        email: firebaseUser.email || email,
        role: UserRole.CUSTOMER,
        avatar: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || 'User')}&background=5B3D9D&color=fff`,
        location: { lat: locationData.lat, lng: locationData.lng },
        locationName: locationData.name,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        lastIP: ip,
        lastDevice: device,
        profileViews: 0
      };
      await dataService.saveUser(newUser);
      await triggerNewSignupAlerts(newUser);
      return newUser;
    }
    
    if (dbUser.isBlocked) throw new Error("Account suspended.");
    
    await checkSecurityAlert(dbUser, ip);
    
    const updatedUser = { 
      ...dbUser, 
      lastLoginAt: new Date().toISOString(),
      lastIP: ip,
      lastDevice: device
    };
    await dataService.saveUser(updatedUser);
    return updatedUser;
  },

  signUp: async (email: string, password: string, name: string): Promise<User | null> => {
    if (!isFirebaseConfigured) throw new Error("Cloud Services not configured.");
    const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const firebaseUser = userCredential.user;
    await updateProfile(firebaseUser, { displayName: name });
    const locationData = await captureSignupLocation();
    const { ip, device } = await captureIdentityContext();
    
    const newUser: User = {
      id: firebaseUser.uid,
      name, email,
      role: UserRole.CUSTOMER,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=5B3D9D&color=fff`,
      location: { lat: locationData.lat, lng: locationData.lng },
      locationName: locationData.name,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      lastIP: ip,
      lastDevice: device,
      profileViews: 0
    };
    await dataService.saveUser(newUser);
    await triggerNewSignupAlerts(newUser);
    return newUser;
  },

  signInWithGoogle: async (): Promise<User | null> => {
    if (!isFirebaseConfigured) throw new Error("Cloud Services not configured.");
    const result = await signInWithPopup(auth, googleProvider);
    let dbUser = await dataService.getUserById(result.user.uid);
    const { ip, device } = await captureIdentityContext();

    if (!dbUser) {
      const locationData = await captureSignupLocation();
      dbUser = {
        id: result.user.uid,
        name: result.user.displayName || 'New User',
        email: result.user.email || '',
        role: UserRole.CUSTOMER,
        avatar: result.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(result.user.displayName || 'User')}`,
        location: { lat: locationData.lat, lng: locationData.lng },
        locationName: locationData.name,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        lastIP: ip,
        lastDevice: device,
        profileViews: 0
      };
      await dataService.saveUser(dbUser);
      await triggerNewSignupAlerts(dbUser);
    } else {
      await checkSecurityAlert(dbUser, ip);
      await dataService.saveUser({
        ...dbUser,
        lastLoginAt: new Date().toISOString(),
        lastIP: ip,
        lastDevice: device
      });
    }
    return dbUser;
  },

  signOut: async () => {
    if (isFirebaseConfigured) await signOut(auth);
    localStorage.removeItem('townhall_user');
  },

  resetPassword: async (email: string) => {
    if (!isFirebaseConfigured) throw new Error("Cloud Services not configured.");
    await sendPasswordResetEmail(auth, email);
  }
};
