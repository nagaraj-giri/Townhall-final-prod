
import { RFQ } from '../types';

export interface MatcherState {
  currentRadius: number;
  showExpansion8km: boolean;
  showExpansion15km: boolean;
  showModifyWarning: boolean;
  isMatchingFinished: boolean;
}

/**
 * UI Matcher Controller - Alignment with Lead Match Plan v1.2
 */
export const getMatchingState = (rfq: RFQ): MatcherState => {
  const createdAt = new Date(rfq.createdAt).getTime();
  const now = Date.now();
  const elapsedMins = (now - createdAt) / 60000;
  const quotes = rfq.quotesCount || 0;

  const state: MatcherState = {
    currentRadius: rfq.searchRadius || 3,
    showExpansion8km: false,
    showExpansion15km: false,
    showModifyWarning: false,
    isMatchingFinished: false
  };

  // Termination Checks
  if (rfq.matchingStopped || ['ACCEPTED', 'COMPLETED', 'CANCELED'].includes(rfq.status)) {
    state.isMatchingFinished = true;
    return state;
  }

  // Phase 1: 0-2m
  if (elapsedMins <= 2) {
    // Check if threshold met early to prepare user
    if (quotes >= 7 && !rfq.expansionApproved_8km) {
      state.showExpansion8km = true;
    }
    return state;
  }

  // Phase 2: 3-4m
  if (elapsedMins > 2 && elapsedMins <= 5) {
    if (quotes >= 7 && !rfq.expansionApproved_8km) {
      state.showExpansion8km = true;
    }
    // If auto-expanded or approved, check for Phase 3 threshold
    if ((quotes < 7 || rfq.expansionApproved_8km) && quotes >= 15 && !rfq.expansionApproved_15km) {
      state.showExpansion15km = true;
    }
    return state;
  }

  // Phase 3 & Completion: 5m+
  if (elapsedMins > 5) {
    if (quotes >= 15 && !rfq.expansionApproved_15km) {
      state.showExpansion15km = true;
    }
    
    // Completion & Customer Feedback Rule:
    // If after all phases (5m+) total quotes < 10, suggest modification.
    if (quotes < 10) {
      state.showModifyWarning = true;
    }

    state.isMatchingFinished = true;
  }

  return state;
};
