import { RFQ } from '../types';

/**
 * Calculates the distance between two points in kilometers using the Haversine formula.
 */
export const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Calculates the current active radius for an RFQ based on precise matching rules.
 * 0–2 mins: 3km
 * 3–4 mins: 8km (if quotes < 7) else ask customer.
 * 5+ mins: 15km (if quotes < 15) else ask customer.
 */
export const calculateActiveRadius = (rfq: RFQ): { radius: number; needsApproval: number | null } => {
  const createdAt = new Date(rfq.createdAt).getTime();
  const now = new Date().getTime();
  const elapsedMinutes = (now - createdAt) / 60000;

  if (elapsedMinutes < 3) {
    return { radius: 3, needsApproval: null };
  }

  if (elapsedMinutes >= 3 && elapsedMinutes < 5) {
    if (rfq.quotesCount < 7) {
      return { radius: 8, needsApproval: null };
    }
    return { 
      radius: rfq.expansionApproved_8km ? 8 : 3, 
      needsApproval: rfq.expansionApproved_8km ? null : 8 
    };
  }

  if (elapsedMinutes >= 5) {
    if (rfq.quotesCount < 15) {
      return { radius: 15, needsApproval: null };
    }
    const currentRadius = rfq.expansionApproved_15km ? 15 : (rfq.expansionApproved_8km ? 8 : 3);
    return { 
      radius: currentRadius, 
      needsApproval: rfq.expansionApproved_15km ? null : 15 
    };
  }

  return { radius: 3, needsApproval: null };
};

export const shouldShowModifyWarning = (rfq: RFQ): boolean => {
  const createdAt = new Date(rfq.createdAt).getTime();
  const elapsedMinutes = (new Date().getTime() - createdAt) / 60000;
  return elapsedMinutes > 7 && rfq.quotesCount < 10;
};