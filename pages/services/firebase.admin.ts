/**
 * WARNING: This file must NOT be imported by any client-side components.
 * It is a placeholder for server-side operations (e.g. Firebase Admin SDK).
 */
export const getAdminDb = () => {
  if (typeof window !== "undefined") {
    throw new Error("CRITICAL: Attempted to access Firebase Admin in browser context.");
  }
  return null; // Implementation would go here for Node.js environments
};