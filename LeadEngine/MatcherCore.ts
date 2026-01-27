
import { RFQ } from '../types';

export interface MatcherState {
  currentRadius: number;
  showExpansion8km: boolean;
  showExpansion15km: boolean;
  showModifyWarning: boolean;
  isMatchingFinished: boolean;
}

/**
 * Calculates the current matching state based on the provided UAE marketplace rules.
 */
export const getMatchingState = (rfq: RFQ): MatcherState => {
  const createdAt = new Date(rfq.createdAt).getTime();
  const now = new Date().getTime();
  const elapsedMins = (now - createdAt) / 60000;

  const state: MatcherState = {
    currentRadius: rfq.searchRadius || 3,
    showExpansion8km: false,
    showExpansion15km: false,
    showModifyWarning: false,
    isMatchingFinished: false
  };

  // Hard Constraint: Process stops if user explicitly stopped it or query is closed
  if (rfq.matchingStopped || rfq.status === 'COMPLETED' || rfq.status === 'CANCELED') {
    state.isMatchingFinished = true;
    return state;
  }

  // --- PHASE 1: Immediate Local (0–2 minutes) ---
  if (elapsedMins < 3) {
    state.currentRadius = 3;
    // Check threshold at the 2-minute mark (or when quotes reach 7)
    if (rfq.quotesCount >= 7 && !rfq.expansionApproved_8km) {
      state.showExpansion8km = true;
    }
    return state;
  }

  // --- PHASE 2: Extended Local (3–4 minutes) ---
  if (elapsedMins >= 3 && elapsedMins < 5) {
    // If quotes were high in phase 1 and no approval, stay at 3km
    if (rfq.quotesCount >= 7 && !rfq.expansionApproved_8km) {
      state.currentRadius = 3;
      state.showExpansion8km = true;
    } else {
      // Auto-expand to 8km if < 7 quotes OR if user approved
      state.currentRadius = 8;
    }

    // Prepare for Phase 3 threshold during Phase 2
    if (state.currentRadius === 8 && rfq.quotesCount >= 7 && !rfq.expansionApproved_15km) {
      state.showExpansion15km = true;
    }
    return state;
  }

  // --- PHASE 3: Final Expansion (After 5 minutes) ---
  if (elapsedMins >= 5) {
    // Hard Constraint: System never exceeds 15km
    const hasEnoughQuotes = rfq.quotesCount >= 15;
    
    if (hasEnoughQuotes && !rfq.expansionApproved_15km) {
      // Stay at 8km if they have 15+ quotes and didn't approve expansion
      state.currentRadius = 8;
      state.showExpansion15km = true;
    } else {
      // Auto-expand to 15km if < 15 quotes OR approved
      state.currentRadius = 15;
    }

    // Completion Check: After 7 mins, suggest modification if quotes are still low
    if (elapsedMins > 7 && rfq.quotesCount < 10) {
      state.showModifyWarning = true;
    }

    state.isMatchingFinished = true;
  }

  return state;
};
