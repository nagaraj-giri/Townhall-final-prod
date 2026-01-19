import { RFQ } from '../types';

export interface MatcherState {
  currentRadius: number;
  showExpansion8km: boolean;
  showExpansion15km: boolean;
  showModifyWarning: boolean;
  isMatchingFinished: boolean;
}

/**
 * Pure function to calculate current matching state based on RFQ age and quote count.
 * Follows the 0-2, 3-4, 5+ minute phase logic.
 */
export const getMatchingState = (rfq: RFQ): MatcherState => {
  const createdAt = new Date(rfq.createdAt).getTime();
  const now = new Date().getTime();
  const elapsedMins = (now - createdAt) / 60000;

  const state: MatcherState = {
    currentRadius: 3,
    showExpansion8km: false,
    showExpansion15km: false,
    showModifyWarning: false,
    isMatchingFinished: false
  };

  // 1. Check if matching was explicitly stopped by user
  if (rfq.matchingStopped) {
    state.currentRadius = rfq.searchRadius || 3;
    state.isMatchingFinished = true;
    return state;
  }

  // --- PHASE 1: 0-2 MINUTES ---
  if (elapsedMins < 3) {
    state.currentRadius = 3;
    
    // Evaluation at the "end" of Phase 1 (approaching 2-3 mins mark)
    if (elapsedMins >= 2 && rfq.quotesCount >= 7 && !rfq.expansionApproved_8km) {
      state.showExpansion8km = true;
    }
    return state;
  }

  // --- PHASE 2: 3-4 MINUTES ---
  if (elapsedMins >= 3 && elapsedMins < 5) {
    // If not approved and we hit 7+ quotes, we stay at 3 and ask
    if (rfq.quotesCount >= 7 && !rfq.expansionApproved_8km) {
      state.currentRadius = 3;
      state.showExpansion8km = true;
    } else {
      // Auto-expand to 8km if < 7 quotes OR if user approved
      state.currentRadius = 8;
    }

    // Prepare for Phase 3 prompt during Phase 2
    // If we reach 7+ quotes in Phase 2 radius, ask about Phase 3
    if (state.currentRadius === 8 && rfq.quotesCount >= 7 && !rfq.expansionApproved_15km) {
      // We only show Phase 3 popup once we are in Phase 2
      // Logic: "If total reaches 7 or more, system displays popup... proceeds to Phase 3"
      state.showExpansion15km = true;
    }
    return state;
  }

  // --- PHASE 3: 5+ MINUTES ---
  if (elapsedMins >= 5) {
    // Determine if we should be at 15km
    const canExpandTo15 = (rfq.quotesCount < 15) || rfq.expansionApproved_15km;
    
    if (canExpandTo15) {
       // Check if expansion to 8 was declined earlier (redundant due to matchingStopped, but safe)
       state.currentRadius = 15;
    } else {
       state.currentRadius = 8;
    }

    // Completion Check: After full search range (using 7 mins as buffer for Phase 3 notifications)
    if (elapsedMins > 7 && rfq.quotesCount < 10) {
      state.showModifyWarning = true;
    }

    state.isMatchingFinished = true;
    return state;
  }

  return state;
};