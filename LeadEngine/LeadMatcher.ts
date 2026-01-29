
import { RFQ } from '../types';

/**
 * Haversine formula for distance calculation in KM
 */
export const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  if (!lat1 || !lng1 || !lat2 || !lng2) return 999;
  const R = 6371;
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
 * Lead Match Plan v1.2 Core Engine Logic
 * Enforces dynamic thresholds and manual expansion triggers.
 */
export const calculateActiveRadius = (rfq: RFQ): number => {
  if (rfq.matchingStopped) {
    return rfq.searchRadius || 3;
  }

  const createdAt = rfq.createdAt ? new Date(rfq.createdAt).getTime() : Date.now();
  const now = Date.now();
  const elapsedMins = (now - createdAt) / 60000;
  const quotes = rfq.quotesCount || 0;

  // PRD Rule: If saturation reached (15 quotes), no further expansion.
  if (quotes >= 15) return rfq.searchRadius || 15;

  // Phase 1: 0–2 mins | Radius: 3 km
  if (elapsedMins <= 2) return 3;

  // Phase 2: 3–4 mins | Radius: 8 km (Triggered only if < 7 quotes OR manually approved)
  if (elapsedMins <= 5) {
    if (quotes >= 7 && !rfq.expansionApproved_8km) return 3;
    return 8;
  }

  // Phase 3: 5+ mins | Radius: 15 km (Hard Constraint: Max 15km)
  if (quotes >= 7 && !rfq.expansionApproved_15km) return rfq.expansionApproved_8km ? 8 : 3;
  return 15;
};
