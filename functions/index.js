
const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Haversine formula for distance (KM)
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * CORE LOGIC: Finds matching providers and records them in the RFQ sub-collection.
 * This identifies providers within the CURRENT search radius and notifies them.
 */
async function syncRFQMatches(rfqId, rfqData) {
  const { service, lat, lng, searchRadius, matchingStopped } = rfqData;
  
  if (matchingStopped) {
    console.log(`[LeadEngine] Matching stopped for RFQ ${rfqId}`);
    return;
  }

  const radius = searchRadius || 3;
  console.log(`[LeadEngine] Processing RFQ ${rfqId} | Service: ${service} | Radius: ${radius}KM`);

  try {
    // 1. Get providers matching the service type via the Manual Index
    const providersSnap = await db.collection('users')
      .where('role', '==', 'PROVIDER')
      .where('services', 'array-contains', service)
      .get();

    if (providersSnap.empty) {
      console.log(`[LeadEngine] No providers found for: ${service}`);
      return;
    }

    const matchPromises = providersSnap.docs.map(async (doc) => {
      const provider = doc.data();
      const pId = doc.id;

      if (!provider.location || !provider.location.lat) return;
      
      const distance = calculateDistance(lat, lng, provider.location.lat, provider.location.lng);
      
      // Check if provider is within the current expansion phase radius
      if (distance <= radius) {
        // CREATE SUB-COLLECTION RECORD
        // Path: rfqs/{rfqId}/matches/{providerId}
        const matchRef = db.collection('rfqs').doc(rfqId).collection('matches').doc(pId);
        
        await matchRef.set({
          providerId: pId,
          providerName: provider.name || 'Service Expert',
          providerAvatar: provider.avatar || '',
          distance: parseFloat(distance.toFixed(2)),
          matchedAtRadius: radius,
          timestamp: new Date().toISOString()
        }, { merge: true });
        
        console.log(`[LeadEngine] Matched Provider ${pId} at ${distance.toFixed(2)}km`);
      }
    });

    await Promise.all(matchPromises);
  } catch (error) {
    console.error(`[LeadEngine] Sync Error:`, error.message);
  }
}

exports.onRFQCreated = functions.region('us-central1').firestore.document('rfqs/{rfqId}').onCreate(async (snap, context) => {
  const rfq = snap.data();
  await syncRFQMatches(context.params.rfqId, rfq);
  return null;
});

exports.onRFQUpdated = functions.region('us-central1').firestore.document('rfqs/{rfqId}').onUpdate(async (change, context) => {
  const before = change.before.data();
  const after = change.after.data();
  
  // Trigger re-match only if radius expanded or matching was resumed
  if (before.searchRadius !== after.searchRadius || (!before.expansionApproved_8km && after.expansionApproved_8km)) {
    await syncRFQMatches(context.params.rfqId, after);
  }
  return null;
});
