
/**
 * Town Hall UAE - Lead Escalation Engine (Production v12.1)
 * Architecture: Root-level Matches Collection (Relational)
 */

const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const geofire = require("geofire-common");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * PHASED NOTIFICATION HELPER
 */
async function dispatchMultiChannelAlert(db, rfqId, rfqData, provider) {
  const batch = db.batch();

  // 1. In-App Bell Notification
  const notifId = `notif_lead_${rfqId}_${provider.id}`;
  batch.set(db.collection("notifications").doc(notifId), {
    id: notifId,
    userId: provider.id,
    title: "🎯 NEW LEAD MATCH",
    message: `${rfqData.service} request found in ${rfqData.locationName}.`,
    type: "SUCCESS",
    targetRole: "PROVIDER",
    actionUrl: `/rfq/${rfqId}`,
    isRead: false,
    timestamp: new Date().toISOString()
  });

  // 2. Email Trigger
  if (provider.email) {
    const emailId = `email_lead_${rfqId}_${provider.id}`;
    batch.set(db.collection("emails").doc(emailId), {
      to: provider.email,
      message: {
        subject: `🎯 New Opportunity: ${rfqData.service} in ${rfqData.locationName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
            <h2 style="color: #5B3D9D;">New Lead Match Found</h2>
            <p>A customer is looking for <strong>${rfqData.service}</strong> near your location.</p>
            <div style="background: #F8F9FA; padding: 15px; border-radius: 10px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Request:</strong> ${rfqData.title}</p>
              <p style="margin: 5px 0 0 0;"><strong>Location:</strong> ${rfqData.locationName}</p>
            </div>
            <a href="https://townhall.sbs/#/rfq/${rfqId}" style="display: inline-block; background: #5B3D9D; color: white; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold;">View Lead & Submit Bid</a>
          </div>
        `
      }
    });
  }

  return batch.commit();
}

/**
 * 1. DISCOVERY INITIALIZATION (Root Index-First)
 */
exports.onRFQCreated = onDocumentCreated("rfqs/{rfqId}", async (event) => {
  const rfqId = event.params.rfqId;
  const rfqData = event.data.data();
  if (!rfqData || !rfqData.location) return;

  const db = admin.firestore();
  
  try {
    // Universal Pooling (15km)
    const center = [rfqData.location.lat, rfqData.location.lng];
    const radiusMeters = 15000;
    const bounds = geofire.geofireQueryBounds(center, radiusMeters);

    const providerSnaps = await Promise.all(bounds.map(b => 
      db.collection("users")
        .where("role", "==", "PROVIDER")
        .where("isVerified", "==", true)
        .where("services", "array-contains", rfqData.service)
        .orderBy("geoHash").startAt(b[0]).endAt(b[1]).get()
    ));

    const allMatchedProviders = [];
    providerSnaps.forEach(s => s.docs.forEach(doc => {
      const p = doc.data();
      const dist = geofire.distanceBetween([p.location.lat, p.location.lng], center);
      if (dist <= 15) {
        allMatchedProviders.push({ id: doc.id, ...p, distance: dist });
      }
    }));

    const uniquePool = Array.from(new Map(allMatchedProviders.map(p => [p.id, p])).values());

    // Bulk Write to STANDALONE ROOT Matches Collection
    const batchSize = 100;
    for (let i = 0; i < uniquePool.length; i += batchSize) {
      const batch = db.batch();
      const chunk = uniquePool.slice(i, i + batchSize);
      
      chunk.forEach(p => {
        // ID format: rfqId_providerId ensures idempotency
        const matchDocId = `${rfqId}_${p.id}`;
        const matchRef = db.collection("matches").doc(matchDocId);
        const phase = p.distance <= 3 ? 1 : p.distance <= 8 ? 2 : 3;
        
        batch.set(matchRef, {
          id: matchDocId,
          rfqId: rfqId,
          providerId: p.id,
          providerName: p.name,
          email: p.email || "",
          phone: p.phone || "",
          distance: p.distance,
          phaseNumber: phase,
          isNotified: false,
          indexedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });
      await batch.commit();
    }

    // Trigger Phase 1 (0-3km)
    const phase1Pros = uniquePool.filter(p => p.distance <= 3);
    for (const pro of phase1Pros) {
      await dispatchMultiChannelAlert(db, rfqId, rfqData, pro);
      await db.collection("matches").doc(`${rfqId}_${pro.id}`).update({
        isNotified: true,
        notifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

  } catch (error) {
    logger.error(`Lead Engine Critical Failure: ${rfqId}`, error);
  }
});

/**
 * 2. ESCALATION ENGINE (Phase-wise expansion)
 */
exports.onRFQUpdated = onDocumentUpdated("rfqs/{rfqId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const rfqId = event.params.rfqId;

  // Expansion Logic: Only trigger if search radius has been increased
  if (after.searchRadius > (before.searchRadius || 0)) {
    const db = admin.firestore();
    
    const unnotifiedMatches = await db.collection("matches")
      .where("rfqId", "==", rfqId)
      .where("isNotified", "==", false)
      .where("distance", "<=", after.searchRadius)
      .get();

    if (unnotifiedMatches.empty) return;

    for (const matchDoc of unnotifiedMatches.docs) {
      const matchData = matchDoc.data();
      const providerProxy = {
        id: matchData.providerId,
        email: matchData.email,
        name: matchData.providerName
      };

      await dispatchMultiChannelAlert(db, rfqId, after, providerProxy);
      
      await matchDoc.ref.update({
        isNotified: true,
        notifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }
});
