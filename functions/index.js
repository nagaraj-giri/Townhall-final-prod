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
 * UTILITY: Email Validation
 */
function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  const regex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return regex.test(email);
}

/**
 * UTILITY: PII Masking for Logs
 */
function maskEmail(email) {
  if (!email || !email.includes("@")) return "invalid-email";
  const [user, domain] = email.split("@");
  if (user.length <= 2) return `*@${domain}`;
  return `${user.substring(0, 2)}***@${domain}`;
}

/**
 * UTILITY: Build Lead Match Email Document
 */
function buildLeadMatchEmail(rfqId, rfqData, provider) {
  const service = rfqData.service || "Service";
  const location = rfqData.locationName || "Dubai";
  const title = rfqData.title || "New Request";
  const providerName = provider.name || "Expert";

  return {
    to: [provider.email],
    message: {
      subject: `🎯 New Opportunity: ${service} in ${location}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
          <h2 style="color: #5B3D9D;">New Lead Match Found</h2>
          <p>Hi ${providerName},</p>
          <p>A customer is looking for <strong>${service}</strong> near your location.</p>
          <div style="background: #F8F9FA; padding: 15px; border-radius: 10px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Request:</strong> ${title}</p>
            <p style="margin: 5px 0 0 0;"><strong>Location:</strong> ${location}</p>
          </div>
          <p style="font-size: 12px; color: #666;">Lead ID: ${rfqId}</p>
          <a href="${CONFIG.APP_BASE_URL}/#/rfq/${rfqId}" style="display: inline-block; background: #5B3D9D; color: white; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold;">View Lead & Submit Bid</a>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 11px; color: #999;">You received this because you are a verified provider on Town Hall UAE.</p>
        </div>
      `
    },
    metadata: {
      type: "LEAD_MATCH",
      rfqId: rfqId,
      providerId: provider.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      version: "2.0"
    }
  };
}

/**
 * PHASED NOTIFICATION HELPER
 */
async function dispatchMultiChannelAlert(db, rfqId, rfqData, provider, triggerConfig = null) {
  const batch = db.batch();
  
  if (!provider || !provider.id) {
    logger.warn(`Cannot dispatch alert: Missing provider ID for RFQ ${rfqId}`);
    return;
  }

  // Fetch Email/Notification Config if not provided
  if (!triggerConfig) {
    let config = { triggers: { "NEW_LEAD": { email: true, inApp: true, push: true, whatsapp: true } } };
    try {
      const configSnap = await db.collection("settings").doc("system_logic").get();
      if (configSnap.exists()) {
        config = configSnap.data();
      }
    } catch (e) {
      logger.warn("Failed to fetch notification config, using defaults", e);
    }
    triggerConfig = config.triggers?.["NEW_LEAD"] || { email: true, inApp: true, push: true, whatsapp: true };
  }

  // 1. In-App Bell Notification
  if (triggerConfig.inApp) {
    const notifId = `notif_lead_${rfqId}_${provider.id}`;
    batch.set(db.collection("notifications").doc(notifId), {
      id: notifId,
      userId: provider.id,
      title: "🎯 NEW LEAD MATCH",
      message: `${rfqData.service || "Service"} request found in ${rfqData.locationName || "your area"}.`,
      type: CONFIG.NOTIF_TYPE_SUCCESS,
      targetRole: CONFIG.ROLE_PROVIDER,
      actionUrl: `${CONFIG.APP_BASE_URL}/#/rfq/${rfqId}`,
      isRead: false,
      sound: "default",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // 2. Email Trigger
  if (triggerConfig.email) {
    if (isValidEmail(provider.email)) {
      const emailId = `email_lead_${rfqId}_${provider.id}`;
      const emailDoc = buildLeadMatchEmail(rfqId, rfqData, provider);
      batch.set(db.collection("emails").doc(emailId), emailDoc);
      
      logger.info("Queued lead match email", {
        rfqId,
        providerId: provider.id,
        recipient: maskEmail(provider.email),
        service: rfqData.service || "unknown"
      });
    } else {
      logger.warn("Skipped email: Invalid or missing address", {
        rfqId,
        providerId: provider.id,
        email: provider.email ? maskEmail(provider.email) : "null"
      });
    }
  }

  // 3. Push Notification (FCM)
  if (triggerConfig.push !== false && provider.fcmTokens && provider.fcmTokens.length > 0) {
    const payload = {
      notification: {
        title: "🎯 NEW LEAD MATCH",
        body: `${rfqData.service || "Service"} in ${rfqData.locationName || "your area"}`,
      },
      data: {
        actionUrl: `/rfq/${rfqId}`,
        type: "LEAD_MATCH"
      }
    };

    try {
      await admin.messaging().sendEachForMulticast({
        tokens: provider.fcmTokens,
        ...payload
      });
      logger.info(`Sent FCM push to provider ${provider.id} for RFQ ${rfqId}`);
    } catch (fcmError) {
      logger.error(`FCM dispatch failed for provider ${provider.id} for RFQ ${rfqId}`, fcmError);
    }
  }

  // 4. WhatsApp Trigger (Queueing)
  if (triggerConfig.whatsapp !== false && provider.phone) {
    const whatsappId = `wa_lead_${rfqId}_${provider.id}`;
    const waBody = `🎯 *New Lead Match*\n\nHi ${provider.name || 'Expert'},\n\nA customer is looking for *${rfqData.service || 'Service'}* in *${rfqData.locationName || 'your area'}*.\n\n*Request:* ${rfqData.title || 'New Request'}\n\nView details and bid here: ${CONFIG.APP_BASE_URL}/#/rfq/${rfqId}`;
    
    // Ensure phone is in E.164 format and prefixed for WhatsApp
    let formattedPhone = provider.phone.trim();
    if (!formattedPhone.startsWith('whatsapp:')) {
      formattedPhone = `whatsapp:${formattedPhone.startsWith('+') ? formattedPhone : '+' + formattedPhone}`;
    }

    batch.set(db.collection("whatsapp_queue").doc(whatsappId), {
      to: formattedPhone,
      body: waBody,
      status: "PENDING",
      metadata: {
        type: "LEAD_MATCH",
        rfqId: rfqId,
        providerId: provider.id
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    logger.info("Queued WhatsApp lead match", { rfqId, providerId: provider.id, recipient: formattedPhone });
  }

  try {
    await batch.commit();
  } catch (commitError) {
    logger.error("Failed to commit notification batch", {
      rfqId,
      providerId: provider.id,
      error: commitError.message
    });
    throw commitError;
  }
}

/**
 * Dispatches a notification to a customer.
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
 * UTILITY: Build Customer RFQ Posted Email
 */
function buildCustomerRFQPostedEmail(rfqId, rfqData) {
  const service = rfqData.service || "Service";
  const title = rfqData.title || "your request";
  const location = rfqData.locationName || "Dubai";

  return {
    to: [rfqData.customerEmail],
    message: {
      subject: `✅ Your request "${title}" is now live!`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
          <h2 style="color: #5B3D9D;">Request Posted Successfully</h2>
          <p>Your request for <strong>${service}</strong> is now active on the TownHall UAE marketplace.</p>
          <div style="background: #F8F9FA; padding: 15px; border-radius: 10px; margin: 20px 0;">
            <p><strong>Title:</strong> ${title}</p>
            <p><strong>Location:</strong> ${location}</p>
          </div>
          <p>We are currently matching you with verified experts in your area. You will receive notifications as soon as quotes start arriving.</p>
          <a href="${CONFIG.APP_BASE_URL}/#/customer/rfq/${rfqId}" style="display: inline-block; background: #5B3D9D; color: white; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold;">Manage My Request</a>
        </div>
      `
    },
    metadata: { type: "RFQ_POSTED", rfqId: rfqId, createdAt: admin.firestore.FieldValue.serverTimestamp() }
  };
}

/**
 * 1. DISCOVERY INITIALIZATION
 */
exports.onRFQCreated = onDocumentCreated("rfqs/{rfqId}", async (event) => {
  const rfqId = event.params.rfqId;
  const rfqData = event.data.data();
  
  if (!rfqData || !rfqData.location) return;

  const db = admin.firestore();
  
  try {
    const center = [rfqData.location.lat, rfqData.location.lng];
    const bounds = geofire.geohashQueryBounds(center, CONFIG.INITIAL_RADIUS_METERS);

    const providerSnaps = await Promise.all(bounds.map(b => 
      db.collection("users")
        .where("role", "==", "PROVIDER")
        .where("services", "array-contains", rfqData.service)
        .orderBy("geoHash").startAt(b[0]).endAt(b[1]).get()
    ));

    const allMatchedProviders = [];
    providerSnaps.forEach(s => s.docs.forEach(doc => {
      const p = doc.data();
      if (p.location && p.location.lat && p.location.lng) {
        const dist = geofire.distanceBetween([p.location.lat, p.location.lng], center);
        if (dist <= CONFIG.INITIAL_RADIUS_KM) {
          allMatchedProviders.push({ id: doc.id, ...p, distance: dist });
        }
      }
    }));

    const uniquePool = Array.from(new Map(allMatchedProviders.map(p => [p.id, p])).values());

    for (let i = 0; i < uniquePool.length; i += CONFIG.FIRESTORE_BATCH_SIZE) {
      const batch = db.batch();
      const chunk = uniquePool.slice(i, i + CONFIG.FIRESTORE_BATCH_SIZE);
      
      chunk.forEach(p => {
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

    const phase1Pros = uniquePool.filter(p => p.distance <= CONFIG.PHASE_1_RADIUS_KM);
    
    const notificationTasks = phase1Pros.map(async (pro) => {
      try {
        await dispatchMultiChannelAlert(db, rfqId, rfqData, pro);
        await db.collection("matches").doc(`${rfqId}_${pro.id}`).update({
          isNotified: true,
          notifiedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (err) {
        logger.error(`Failed to notify provider ${pro.id} for RFQ ${rfqId}`, err);
      }
    });

    await Promise.all(notificationTasks);

    if (isValidEmail(rfqData.customerEmail)) {
      const customerEmailId = `email_posted_${rfqId}`;
      const emailDoc = buildCustomerRFQPostedEmail(rfqId, rfqData);
      await db.collection("emails").doc(customerEmailId).set(emailDoc);
    }

    await dispatchCustomerNotification(
      db,
      rfqData.customerId,
      rfqId,
      "✅ REQUEST POSTED",
      `Your request for "${rfqData.service || "Service"}" is now live. We are matching you with experts!`
    );

  } catch (error) {
    logger.error(`Lead Engine Critical Failure: ${rfqId}`, error);
  }
});

/**
 * 2. ESCALATION ENGINE
 */
exports.onRFQUpdated = onDocumentUpdated("rfqs/{rfqId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const rfqId = event.params.rfqId;

  if (after.searchRadius > (before.searchRadius || 0)) {
    const db = admin.firestore();
    const unnotifiedMatches = await db.collection("matches")
      .where("rfqId", "==", rfqId)
      .where("isNotified", "==", false)
      .where("distance", "<=", after.searchRadius)
      .get();

    if (unnotifiedMatches.empty) return;

    const escalationTasks = unnotifiedMatches.docs.map(async (matchDoc) => {
      const matchData = matchDoc.data();
      try {
        const providerSnap = await db.collection("users").doc(matchData.providerId).get();
        if (!providerSnap.exists) return;
        
        const providerData = { id: providerSnap.id, ...providerSnap.data() };
        await dispatchMultiChannelAlert(db, rfqId, after, providerData);
        await matchDoc.ref.update({
          isNotified: true,
          notifiedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (err) {
        logger.error(`Escalation failed for provider ${matchData.providerId}`, err);
      }
    });

    await Promise.all(escalationTasks);
  }
});

/**
 * 3. QUOTE SUBMISSION NOTIFICATION
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
      `${quoteData.providerName || "A provider"} submitted a proposal for "${rfqData.title || "your request"}" at AED ${quoteData.price}.`,
  );

  if (isValidEmail(rfqData.customerEmail)) {
    const emailId = `email_quote_${event.params.quoteId}`;
    batch.set(db.collection("emails").doc(emailId), {
      to: [rfqData.customerEmail],
      message: {
        subject: `💰 New Quote for ${rfqData.title || "your request"}`,
        html: `<p>${quoteData.providerName} bid AED ${quoteData.price}. <a href="${CONFIG.APP_BASE_URL}/#/customer/rfq/${rfqData.id}">Review</a></p>`
      }
    });
  }

  return batch.commit();
});

/**
 * 4. STATUS TRANSITION NOTIFICATIONS
 */
exports.onRFQStatusChanged = onDocumentUpdated("rfqs/{rfqId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const rfqId = event.params.rfqId;

  if (before.status === after.status) return;

  const db = admin.firestore();
  const batch = db.batch();

  // 4.1 RFQ ACCEPTED
  if (after.status === "ACCEPTED" && after.acceptedQuoteId) {
    const quoteSnap = await db.collection("quotes").doc(after.acceptedQuoteId).get();
    const quoteData = quoteSnap.data();

    if (quoteData) {
      const notifId = `notif_accepted_${rfqId}`;
      batch.set(db.collection("notifications").doc(notifId), {
        id: notifId,
        userId: quoteData.providerId,
        title: "🎉 QUOTE ACCEPTED",
        message: `Your proposal for "${after.title}" was accepted!`,
        type: CONFIG.NOTIF_TYPE_SUCCESS,
        targetRole: CONFIG.ROLE_PROVIDER,
        actionUrl: `${CONFIG.APP_BASE_URL}/#/rfq/${rfqId}`,
        sound: "default",
        isRead: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  // 4.2 RFQ COMPLETED
  if (after.status === "COMPLETED" && after.acceptedQuoteId) {
    const quoteSnap = await db.collection("quotes").doc(after.acceptedQuoteId).get();
    const quoteData = quoteSnap.data();
    if (quoteData) {
      const notifId = `notif_completed_${rfqId}`;
      batch.set(db.collection("notifications").doc(notifId), {
        id: notifId,
        userId: quoteData.providerId,
        title: "✅ PROJECT COMPLETED",
        message: `The customer marked "${after.title}" as completed. Great job!`,
        type: CONFIG.NOTIF_TYPE_SUCCESS,
        targetRole: CONFIG.ROLE_PROVIDER,
        actionUrl: `${CONFIG.APP_BASE_URL}/#/rfq/${rfqId}`,
        sound: "default",
        isRead: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  // 4.3 RFQ CANCELED
  if (after.status === "CANCELED") {
    const quotesSnap = await db.collection("quotes").where("rfqId", "==", rfqId).get();
    quotesSnap.docs.forEach(doc => {
      const q = doc.data();
      const notifId = `notif_canceled_${rfqId}_${q.providerId}`;
      batch.set(db.collection("notifications").doc(notifId), {
        id: notifId,
        userId: q.providerId,
        title: "⚠️ REQUEST CANCELED",
        message: `The customer canceled "${after.title}". Your proposal is no longer active.`,
        type: "WARNING",
        targetRole: CONFIG.ROLE_PROVIDER,
        sound: "default",
        isRead: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  }

  return batch.commit();
});

/**
 * 5. QUOTE STATUS UPDATES (REJECTION)
 */
exports.onQuoteUpdated = onDocumentUpdated("quotes/{quoteId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  
  if (before.status === after.status) return;

  if (after.status === "REJECTED") {
    const db = admin.firestore();
    const notifId = `notif_rejected_${event.params.quoteId}`;
    await db.collection("notifications").doc(notifId).set({
      id: notifId,
      userId: after.providerId,
      title: "❌ PROPOSAL REJECTED",
      message: `Your proposal for "${after.rfqTitle || "the request"}" was not selected.`,
      type: "WARNING",
      targetRole: CONFIG.ROLE_PROVIDER,
      isRead: false,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
});

/**
 * TRIGGER: WhatsApp Message Dispatcher
 */
exports.onWhatsAppQueued = onDocumentCreated("whatsapp_queue/{msgId}", async (event) => {
  const snap = event.data;
  const data = snap.data();

  if (data.status !== "PENDING") return null;

  try {
    // Use Account SID and Auth Token directly
    const accountSid = process.env.TWILIO_SID; 
    const authToken = process.env.TWILIO_SECRET;
    const twilioFrom = process.env.TWILIO_FROM;

    if (!accountSid || !authToken || !twilioFrom) {
      logger.error("Twilio environment variables are not set.");
      await snap.ref.update({status: "ERROR", error: "Missing Twilio config"});
      return;
    }

    // Simplified initialization for standard Account SID + Auth Token
    const twilio = require("twilio")(accountSid, authToken);

    // Ensure the "from" number has the whatsapp: prefix
    const from = twilioFrom.startsWith('whatsapp:') ? twilioFrom : `whatsapp:${twilioFrom}`;

    const message = await twilio.messages.create({from: from, to: data.to, body: data.body});
    await snap.ref.update({status: "SENT", messageSid: message.sid});
  } catch (error) {
    logger.error("Error sending WhatsApp message:", error);
    await snap.ref.update({status: "ERROR", error: error.message});
  }
});
