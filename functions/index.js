
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

const CONFIG = {
  // Geo-query configuration
  INITIAL_RADIUS_METERS: 15000,
  INITIAL_RADIUS_KM: 15,
  PHASE_1_RADIUS_KM: 3,
  PHASE_2_RADIUS_KM: 8,

  // Batch write size
  FIRESTORE_BATCH_SIZE: 100,

  // Base URL for client-side actions
  APP_BASE_URL: "https://townhall.sbs",

  // Notification constants
  NOTIF_TYPE_SUCCESS: "SUCCESS",
  NOTIF_TYPE_INFO: "INFO",
  ROLE_PROVIDER: "PROVIDER",
  ROLE_CUSTOMER: "CUSTOMER",
};
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
    type: CONFIG.NOTIF_TYPE_SUCCESS,
    targetRole: CONFIG.ROLE_PROVIDER,
    actionUrl: `${CONFIG.APP_BASE_URL}/#/rfq/${rfqId}`,
    isRead: false,
    sound: "default", // Suggests the client should play a notification sound
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 2. Email Trigger
  if (provider.email) {
    const emailId = `email_lead_${rfqId}_${provider.id}`;
    batch.set(db.collection("emails").doc(emailId), {
      to: [provider.email],
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
            <a href="${CONFIG.APP_BASE_URL}/#/rfq/${rfqId}" style="display: inline-block; background: #5B3D9D; color: white; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold;">View Lead & Submit Bid</a>
          </div>
        `
      }
    });
  }

  return batch.commit();
}

/**
 * Dispatches a notification to a customer.
 * @param {FirebaseFirestore.Firestore} db The Firestore instance.
 * @param {string} customerId The ID of the customer.
 * @param {string} rfqId The ID of the RFQ.
 * @param {string} title The notification title.
 * @param {string} message The notification message.
 * @return {Promise<void>}
 */
async function dispatchCustomerNotification(db, customerId, rfqId, title, message) {
  const customerNotifId = `notif_customer_${rfqId}_${Date.now()}`;
  await db.collection("notifications").doc(customerNotifId).set({
    id: customerNotifId,
    userId: customerId,
    title: title,
    message: message,
    type: CONFIG.NOTIF_TYPE_SUCCESS,
    targetRole: CONFIG.ROLE_CUSTOMER,
    actionUrl: `${CONFIG.APP_BASE_URL}/#/customer/rfq/${rfqId}`,
    sound: "default",
    isRead: false,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
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
    const bounds = geofire.geofireQueryBounds(center, CONFIG.INITIAL_RADIUS_METERS);

    const providerSnaps = await Promise.all(bounds.map(b => 
      db.collection("users")
        .where("role", "==", "PROVIDER")
        .where("services", "array-contains", rfqData.service)
        .orderBy("geoHash").startAt(b[0]).endAt(b[1]).get()
    ));

    const allMatchedProviders = [];
    providerSnaps.forEach(s => s.docs.forEach(doc => {
      const p = doc.data();
      const dist = geofire.distanceBetween([p.location.lat, p.location.lng], center);
      if (dist <= CONFIG.INITIAL_RADIUS_KM) {
        allMatchedProviders.push({ id: doc.id, ...p, distance: dist });
      }
    }));

    const uniquePool = Array.from(new Map(allMatchedProviders.map(p => [p.id, p])).values());

    // Bulk Write to STANDALONE ROOT Matches Collection
    for (let i = 0; i < uniquePool.length; i += CONFIG.FIRESTORE_BATCH_SIZE) {
      const batch = db.batch();
      const chunk = uniquePool.slice(i, i + CONFIG.FIRESTORE_BATCH_SIZE);
      
      chunk.forEach(p => {
        // ID format: rfqId_providerId ensures idempotency
        const matchDocId = `${rfqId}_${p.id}`;
        const matchRef = db.collection("matches").doc(matchDocId);
        const phase = p.distance <= CONFIG.PHASE_1_RADIUS_KM ? 1 : p.distance <= CONFIG.PHASE_2_RADIUS_KM ? 2 : 3;
        
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
    const phase1Pros = uniquePool.filter(p => p.distance <= CONFIG.PHASE_1_RADIUS_KM);
    for (const pro of phase1Pros) {
      await dispatchMultiChannelAlert(db, rfqId, rfqData, pro);
      await db.collection("matches").doc(`${rfqId}_${pro.id}`).update({
        isNotified: true,
        notifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Notify Customer about matches
    if (uniquePool.length > 0) {
      await dispatchCustomerNotification(
          db,
          rfqData.customerId,
          rfqId,
          "🚀 MATCHES FOUND!",
          `We found ${uniquePool.length} verified providers for your "${rfqData.service}" request. Expect quotes soon!`,
      );
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

/**
 * 3. QUOTE SUBMISSION NOTIFICATION (Notify Customer)
 */
exports.onQuoteCreated = onDocumentCreated("quotes/{quoteId}", async (event) => {
  const quoteData = event.data.data();
  if (!quoteData) return;

  const db = admin.firestore();
  const rfqSnap = await db.collection("rfqs").doc(quoteData.rfqId).get();
  const rfqData = rfqSnap.data();

  if (!rfqData) return;

  const batch = db.batch();
  await dispatchCustomerNotification(
      db,
      rfqData.customerId,
      quoteData.rfqId,
      "💰 NEW QUOTE RECEIVED",
      `${quoteData.providerName} submitted a proposal for "${rfqData.title}" at AED ${quoteData.price}.`,
  );

  // Email for Customer
  if (rfqData.customerEmail) {
    batch.set(db.collection("emails").doc(`email_quote_${quoteData.id}`), {
      to: [rfqData.customerEmail], // Corrected: 'to' field must be an array
      message: {
        subject: `💰 New Quote for ${rfqData.title}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
            <h2 style="color: #5B3D9D;">New Quote Received</h2>
            <p><strong>${quoteData.providerName}</strong> has sent you a proposal for your request.</p>
            <div style="background: #F8F9FA; padding: 15px; border-radius: 10px; margin: 20px 0;">
              <p><strong>Amount:</strong> AED ${quoteData.price}</p>
              <p><strong>Message:</strong> ${quoteData.message}</p>
            </div>
            <a href="${CONFIG.APP_BASE_URL}/#/customer/rfq/${rfqData.id}" style="display: inline-block; background: #5B3D9D; color: white; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold;">Review Proposal</a>
          </div>
        `
      }
    });
  }

  return batch.commit();
});

/**
 * 4. STATUS TRANSITION NOTIFICATIONS (ACCEPTED / COMPLETED)
 */
exports.onRFQStatusChanged = onDocumentUpdated("rfqs/{rfqId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const rfqId = event.params.rfqId;

  if (before.status === after.status) return;

  const db = admin.firestore();
  const batch = db.batch();

  // CASE: QUOTE ACCEPTED
  if (after.status === "ACCEPTED" && after.acceptedQuoteId) {
    const quoteSnap = await db.collection("quotes").doc(after.acceptedQuoteId).get();
    const quoteData = quoteSnap.data();

    if (quoteData) {
      const notifId = `notif_accepted_${rfqId}`;
      batch.set(db.collection("notifications").doc(notifId), {
        id: notifId,
        userId: quoteData.providerId,
        title: "🎉 CONGRATULATIONS! QUOTE ACCEPTED",
        message: `Your proposal for "${after.title}" has been accepted by the customer. Open chat to finalize details.`,
        type: CONFIG.NOTIF_TYPE_SUCCESS,
        targetRole: CONFIG.ROLE_PROVIDER,
        actionUrl: `${CONFIG.APP_BASE_URL}/#/rfq/${rfqId}`,
        sound: "default",
        isRead: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (quoteData.providerEmail) {
        batch.set(db.collection("emails").doc(`email_accepted_${rfqId}`), {
          to: [quoteData.providerEmail],
          message: {
            subject: `🎉 Opportunity Secured: ${after.title}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                <h2 style="color: #5B3D9D;">Your Quote was Accepted!</h2>
                <p>The customer has selected your proposal for <strong>${after.title}</strong>.</p>
                <p>Please log in to the TownHall dashboard to start the conversation and finalize the service delivery.</p>
                <a href="${CONFIG.APP_BASE_URL}/#/rfq/${rfqId}" style="display: inline-block; background: #5B3D9D; color: white; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold;">Open Dashboard</a>
              </div>
            `
          }
        });
      }
    }
  }

  // CASE: JOB COMPLETED
  if (after.status === "COMPLETED" && after.acceptedQuoteId) {
    const quoteSnap = await db.collection("quotes").doc(after.acceptedQuoteId).get();
    const quoteData = quoteSnap.data();

    if (quoteData) {
      const notifId = `notif_completed_${rfqId}`;
      batch.set(db.collection("notifications").doc(notifId), {
        id: notifId,
        userId: quoteData.providerId,
        title: "✅ JOB MARKED AS COMPLETED",
        message: `The customer has marked "${after.title}" as completed. Great job!`,
        type: CONFIG.NOTIF_TYPE_INFO,
        targetRole: CONFIG.ROLE_PROVIDER,
        actionUrl: `${CONFIG.APP_BASE_URL}/#/rfq/${rfqId}`,
        sound: "default",
        isRead: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Add email notification for job completion
      if (quoteData.providerEmail) {
        batch.set(db.collection("emails").doc(`email_completed_${rfqId}`), {
          to: [quoteData.providerEmail],
          message: {
            subject: `✅ Job Completed: ${after.title}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
                <h2 style="color: #5B3D9D;">Job Marked as Completed</h2>
                <p>The customer has marked the job "<strong>${after.title}</strong>" as completed. Thank you for your great work!</p>
              </div>
            `,
          },
        });
      }
    }
  }

  // CASE: JOB CANCELED
  if (after.status === "CANCELED") {
    const quotesSnap = await db.collection("quotes").where("rfqId", "==", rfqId).get();
    quotesSnap.docs.forEach(doc => {
      const quoteData = doc.data();
      const notifId = `notif_canceled_${rfqId}_${quoteData.providerId}`;
      batch.set(db.collection("notifications").doc(notifId), {
        id: notifId,
        userId: quoteData.providerId,
        title: "🚫 JOB CANCELED",
        message: `The request "${after.title}" has been canceled by the customer.`,
        type: CONFIG.NOTIF_TYPE_INFO,
        targetRole: CONFIG.ROLE_PROVIDER,
        actionUrl: `${CONFIG.APP_BASE_URL}/#/rfq/${rfqId}`,
        sound: "default",
        isRead: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  }

  return batch.commit();
});

/**
 * TRIGGER: WhatsApp Message Dispatcher
 * @summary Processes queued WhatsApp messages and dispatches them via Twilio.
 * @description This Cloud Function is triggered when a new document is
 *   created in the "whatsapp_queue" Firestore collection. It checks the
 *   message status, constructs a Twilio API request, sends the message, and
 *   updates the document's status based on the Twilio response.
 */
exports.onWhatsAppQueued = onDocumentCreated("whatsapp_queue/{msgId}", async (event) => {
  const snap = event.data;
  const data = snap.data();

  if (data.status !== "PENDING") return null;

  try {
    const twilioSid = process.env.TWILIO_SID;
    const twilioSecret = process.env.TWILIO_SECRET;
    const twilioAccSid = process.env.TWILIO_ACC_SID;
    const twilioFrom = process.env.TWILIO_FROM;

    if (!twilioSid || !twilioSecret || !twilioAccSid || !twilioFrom) {
      logger.error("Twilio environment variables are not set.");
      await snap.ref.update({status: "ERROR", error: "Missing Twilio config"});
      return;
    }

    const twilio = require("twilio")(twilioSid, twilioSecret, {
      accountSid: twilioAccSid,
    });

    const message = await twilio.messages.create({from: twilioFrom, to: data.to, body: data.body});
    await snap.ref.update({status: "SENT", messageSid: message.sid});
  } catch (error) {
    logger.error("Error sending WhatsApp message:", error);
    await snap.ref.update({status: "ERROR", error: error.message});
  }
});
