import * as firebaseAuth from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from './services/firebase';
import { User, UserRole } from '../types';
import { dataService } from './services/dataService';
import { getCurrentLocation, reverseGeocode } from '../Functions/placesfield';

// Fixed: Using namespaced imports and destructuring to resolve missing exported member errors for auth functions.
const { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  signInWithPopup, 
  onAuthStateChanged,
  sendPasswordResetEmail
} = firebaseAuth as any;

/**
 * Captures user location seamlessly. 
 * Races against a 3s timeout to ensure no interruption to the UX.
 */
const captureSignupLocation = async () => {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("Location timeout")), 3000)
  );

  try {
    // Race the GPS lock against a strict 3-second timeout
    const coords = await Promise.race([getCurrentLocation(), timeoutPromise]) as {lat: number, lng: number};
    
    // Attempt to get a neighborhood name, race against another 2s timeout
    const geocodeTimeout = new Promise((resolve) => setTimeout(() => resolve('Dubai, UAE'), 2000));
    const name = await Promise.race([reverseGeocode(coords.lat, coords.lng), geocodeTimeout]) as string;
    
    return {
      lat: coords.lat,
      lng: coords.lng,
      name: name
    };
  } catch (e) {
    // Default to Downtown Dubai center point if user denies or GPS is slow
    return {
      lat: 25.185,
      lng: 55.275,
      name: 'Dubai, UAE'
    };
  }
};

export const authService = {
  signIn: async (email: string, password: string): Promise<User | null> => {
    if (!isFirebaseConfigured) {
      throw new Error("Cloud Services are not configured. Please check your environment.");
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      if (!firebaseUser) throw new Error("Authentication failed: No user returned.");
      
      const dbUser = await dataService.getUserById(firebaseUser.uid);
      
      if (!dbUser) {
        const locationData = await captureSignupLocation();
        const fallbackUser: User = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'Marketplace User',
          email: firebaseUser.email || email,
          role: UserRole.CUSTOMER,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || 'User')}&background=5B3D9D&color=fff`,
          location: { lat: locationData.lat, lng: locationData.lng },
          locationName: locationData.name,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };
        await dataService.saveUser(fallbackUser);
        return fallbackUser;
      }
      
      if (dbUser.isBlocked) throw new Error("This account has been suspended by an administrator.");
      
      const updatedUser = { ...dbUser, lastLoginAt: new Date().toISOString() };
      await dataService.saveUser(updatedUser);
      return updatedUser;
    } catch (error: any) {
      console.error("Auth failed:", error.message);
      throw error;
    }
  },

  signInWithGoogle: async (): Promise<User | null> => {
    if (!isFirebaseConfigured) {
      throw new Error("Cloud Services are not configured.");
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      if (!firebaseUser) throw new Error("Google authentication failed.");
      let dbUser = await dataService.getUserById(firebaseUser.uid);
      
      if (!dbUser) {
        const locationData = await captureSignupLocation();
        dbUser = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'New User',
          email: firebaseUser.email || '',
          role: UserRole.CUSTOMER,
          avatar: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || 'User')}`,
          location: { lat: locationData.lat, lng: locationData.lng },
          locationName: locationData.name,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };
        await dataService.saveUser(dbUser);
      }
      
      return dbUser;
    } catch (error: any) {
      console.error("Google Auth Error:", error);
      throw error;
    }
  },

  signUp: async (name: string, email: string, password: string): Promise<User> => {
    if (!isFirebaseConfigured) {
      throw new Error("Registration requires an active cloud connection.");
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      if (!firebaseUser) throw new Error("Registration failed.");
      
      const locationData = await captureSignupLocation();
      const newUser: User = {
        id: firebaseUser.uid,
        name,
        email,
        role: UserRole.CUSTOMER,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=5B3D9D&color=fff`,
        location: { lat: locationData.lat, lng: locationData.lng },
        locationName: locationData.name,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
      await dataService.saveUser(newUser);
      return newUser;
    } catch (error: any) {
      throw error;
    }
  },

  signOut: async () => {
    if (isFirebaseConfigured) {
      try { await signOut(auth); } catch(e) {}
    }
    localStorage.removeItem('townhall_user');
  },

  resetPassword: async (email: string) => {
    if (!isFirebaseConfigured) throw new Error("Cloud Services not configured.");
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      console.error("Password reset failed:", error);
      throw error;
    }
  },
  
  onAuthChange: (callback: (user: User | null) => void) => {
    if (!isFirebaseConfigured) return () => {};
    return onAuthStateChanged(auth, async (firebaseUser: any) => {
      if (firebaseUser) {
        const dbUser = await dataService.getUserById(firebaseUser.uid);
        callback(dbUser);
      } else {
        callback(null);
      }
    });
  }
};