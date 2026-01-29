
const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

// --- HELPER: Send Email via Trigger Email Extension ---
async function enqueueEmail(toEmail, subject, html, buttonLabel, buttonUrl) {
  return db.collection('emails').add({
    to: [toEmail],
    cc: ["nagaraj.giri@zohomail.com"],
    message: {
      subject: subject,
      html: `
        <div style="font-family: sans-serif; padding: 50px 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 40px; background-color: #ffffff;">
          <!-- PRODUCT LOGO CENTER ALIGNED -->
          <div style="text-align: center; margin-bottom: 50px;">
            <img src="https://i.postimg.cc/mD8z7DqZ/townhall-logo.png" width="110" style="display: inline-block; border: 0;">
          </div>
          <!-- CONTENT BLOCK WITH SPACE -->
          <div style="padding: 0 25px;">
            ${html}
            <div style="margin-top: 45px; text-align: center;">
              <a href="${buttonUrl}" style="background-color: #5B3D9D; color: white; padding: 18px 38px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; font-size: 14px;">
                ${buttonLabel}
              </a>
            </div>
          </div>
          <div style="margin-top: 60px; border-top: 1px solid #eee; padding-top: 30px; text-align: center; color: #bbb; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">
            Town Hall UAE • Premium Marketplace
          </div>
        </div>
      `
    },
    delivery: { startTime: new Date() }
  });
}

/**
 * AUTOMATION: onProviderRequestApproved
 */
exports.onProviderRequestApproved = functions.firestore
  .document('provider_requests/{reqId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status !== 'APPROVED' && after.status === 'APPROVED') {
      const { email, businessName, services, locationName, lat, lng, whatsapp } = after;
      try {
        let userRecord;
        try {
          userRecord = await admin.auth().getUserByEmail(email);
        } catch (e) {
          userRecord = await admin.auth().createUser({
            email: email,
            emailVerified: true,
            displayName: businessName,
            disabled: false
          });
        }

        const userRef = db.collection('users').doc(userRecord.uid);
        await userRef.set({
          id: userRecord.uid,
          name: businessName,
          email: email.toLowerCase(),
          role: 'PROVIDER',
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(businessName)}&background=5B3D9D&color=fff`,
          services: services,
          categories: services,
          locationName: locationName,
          location: { lat: lat, lng: lng },
          phone: `+971 ${whatsapp}`,
          createdAt: new Date().toISOString(),
          profileViews: 0,
          rating: 5.0,
          isVerified: true,
          status: 'verified'
        }, { merge: true });

        const setupLink = await admin.auth().generatePasswordResetLink(email, {
          url: 'https://townhall.sbs/#/login'
        });

        await enqueueEmail(
          email,
          "Welcome to Town Hall UAE - Action Required",
          `<h2 style="text-align: center; color: #5B3D9D; font-weight: 900;">Welcome to the Network, ${businessName}</h2>
           <p style="text-align: center; font-size: 15px; color: #666; line-height: 1.6;">Your application has been approved. You are now a <b>Verified Service Provider</b> on Town Hall UAE.</p>
           <p style="text-align: center; font-size: 15px; color: #666; line-height: 1.6;">To access your dashboard and start receiving leads, please set up your account password by clicking the button below.</p>
           <p style="font-size: 12px; color: #999; margin-top: 35px; text-align: center; border-top: 1px dashed #eee; padding-top: 20px;"><b>Login Email:</b> ${email}</p>`,
          "Set Up Password",
          setupLink
        );

        await db.collection('audit_logs').add({
          title: `Automated Onboarding: ${businessName}`,
          type: "SYSTEM_AUTOMATION",
          severity: "MEDIUM",
          eventId: change.after.id,
          timestamp: new Date().toISOString(),
          userName: "Onboarding Engine",
          userRole: "SYSTEM",
          details: { userId: userRecord.uid, email: email }
        });

      } catch (error) {
        console.error("[Automation] Onboarding Failure:", error);
      }
    }
    return null;
  });

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Lead Matching Trigger (Phase 1 Initial Sync)
 */
exports.onRFQCreated = functions.firestore.document('rfqs/{rfqId}').onCreate(async (snap) => {
  const rfq = snap.data();
  const radius = 3; 
  const providersSnap = await db.collection('users').where('role', '==', 'PROVIDER').where('services', 'array-contains', rfq.service).get();
  
  const batch = db.batch();
  providersSnap.docs.forEach(doc => {
    const p = doc.data();
    if (!p.location) return;
    const dist = getDistance(rfq.lat, rfq.lng, p.location.lat, p.location.lng);
    
    if (dist <= radius) {
      const matchRef = db.collection('rfqs').doc(snap.id).collection('matches').doc(doc.id);
      batch.set(matchRef, { providerId: doc.id, providerName: p.name, distance: dist, timestamp: new Date().toISOString() });
      
      const trackRef = db.collection('rfqs').doc(snap.id).collection('notified_providers').doc(doc.id);
      batch.set(trackRef, { 
        notifiedAt: new Date().toISOString(), 
        radiusAtTrigger: radius, 
        phase: "Phase 1" 
      });
    }
  });
  return batch.commit();
});
