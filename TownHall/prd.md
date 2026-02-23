# my final draft PRD
strictly no changes without my permissions
# Product Requirements Document (PRD)

## 1. Executive Summary

TownHall UAE is a premium B2C and B2B digital services marketplace designed to connect **high-intent customers** with **verified, licensed service providers** (Home Services, PROs, Business Consultants, Visa Experts, Legal, Travel, etc.).

The platform is built on three non-negotiables:

* **Trust-first interactions** through mandatory provider verification
* **Speed-driven lead matching** using geo-based phased expansion
* **Transparency-by-design** with audit-ready workflows

TownHall positions itself as a **"Premium Dubai" marketplace** — fast, elegant, regulated, and reliable.

---

## 2. Strategic Objectives

| Objective              | Description                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| Localized Trust        | Prioritize providers within 3–15 km for faster, accountable service |
| Pricing Transparency   | Enable competitive discovery via multi-quote bidding                |
| Operational Integrity  | Maintain complete audit trails for compliance & safety              |
| UAE Premium Experience | Deliver a luxury, executive-grade UI aligned with Dubai standards   |

---

## 3. User Roles & Access Control

| Role     | Responsibility                                  | Core Access                                                  |
| -------- | ----------------------------------------------- | ------------------------------------------------------------ |
| Customer | Post queries, compare quotes, hire providers    | Dashboard, Query Creator, Quotes, Chat, Profile              |
| Provider | Receive leads, submit quotes, manage storefront | Lead Board, Quote Center, Storefront, Chat                   |
| Admin    | Platform governance & quality control           | Audit Logs, User Directory, Broadcast Center, Matching Rules |

---

## 4. Functional Requirements

### 4.1 Lead Engine (Geo-Based Dynamic Matching)

The Lead Engine ensures **local-first discovery** with controlled expansion.

**Phase-based Matching Logic**

| Phase   | Time Window | Radius    | Behavior                       |
| ------- | ----------- | --------- | ------------------------------ |
| Phase 1 | 0–2 mins    | 0–3 km    | Notify all eligible providers  |
| Phase 2 | 3–4 mins    | 3.5–8 km  | Triggered if < 7 quotes        |
| Phase 3 | 5+ mins     | 8.1–15 km | Triggered if < 10 total quotes |

After Phase 3 if customer has < 10 query then inform customer that try post a new query with different location for more bids.

**Threshold Rationale**

* 7 quotes = healthy comparison set without overload
* 15 quotes = saturation limit; marginal value drops beyond this

**Customer Control Rule**

* If ≥ 7 quotes are received at any phase, customer is prompted to approve further expansion
* If declined, lead matching **permanently stops**

**Hard Constraint**

* System must never match beyond **15 km**

---

### 4.3 High-Trust Messaging System

Messaging is designed for **accountability, not noise**.

**Rules & Features**

* Chat unlocks only after a provider submits a quote
* Customers can chat with multiple providers before acceptance
* Rich media support for document & site verification
* Real-time typing indicators and read receipts and seen message
* Admin moderation controls: mute, suspend, or revoke chat access per query

---

### 4.4 Provider Storefront System

Each provider maintains a public-facing, credibility-first storefront.

**Storefront Components**

| Element             | Description                                                 |
| ------------------- | ----------------------------------------------------------- |
| Business Profile    | Verified company name & license status                      |
| Service Stream      | Assigned Service keys, categories                         |
| Portfolio           | Image-based proof of previous work                          |
| Performance Metrics | Avg rating (5★), median response time, total jobs completed |

---

### 4.5 Notification & Communication System

The platform uses a **multi-channel notification framework** to ensure timely awareness without overwhelming users.

#### 4.5.1 Toast Messages (In-App, Real-Time)

Lightweight, non-blocking messages for immediate feedback.

**Usage Scenarios**

* Quote submitted successfully
* New bid received
* Status change (OPEN → ACTIVE, ACCEPTED, COMPLETED, CANCELED)
* Query canceled confirmation for customer and admin

**Rules**

* All toast Auto-dismiss within 4 seconds
* Never used for critical or irreversible actions

#### 4.5.2 Bell Icon Alerts (Persistent Notifications)

A bell icon in the header displays unread notifications requiring attention.

**Triggers**

* New quote received
* Quote accepted or rejected
* New chat message
* Admin action on query or account

**Behavior**

* Badge count shows unread alerts
* Clicking bell icon opens a chronological notification list, clicking message to redirection.
* Alerts persist until explicitly viewed
* Mark all as Read function

#### 4.5.3 Email Triggers (Out-of-App Communication)

Email is used for **important lifecycle events** and re-engagement.

**Email Events**

| Event            | Recipient           |
| ---------------- | ------------------- |
| New bid received | Customer            |
| Quote accepted   | Provider            |
| Query completed  | Customer & Provider |
| Query canceled   | Customer & Provider |
| Admin action     | Affected user       |
| New lead match  | providers            |

**Rules**

* use configured templates based on user roles and use cases


---

### 4.6 Chat Function

The Chat Function is a **contextual, query-bound communication layer** designed to support decision-making and service execution while maintaining trust and auditability.

**Access Rules**

* Chat is enabled to cusotmer only after a provider submits a quote
* Only customer can initiate the chat.
* Customers may chat with multiple providers before acceptance
* Once a quote is ACCEPTED, chat becomes exclusive between customer and selected provider
* Admins can access chats for moderation and dispute resolution

**Core Capabilities**

| Capability      | Description                                                   |
| --------------- | ------------------------------------------------------------- |
| Text Messaging  | Real-time, low-latency messaging                              |
| Media Sharing   | Photos and documents for requirement or proof verification    |
| Presence        | Online status, typing indicators, read receipts, Seen status. |
| Context Locking | Chat is permanently tied to a specific query                  |

**Lifecycle Behavior**

* OPEN / ACTIVE: Multi-provider chat allowed
* ACCEPTED: Single-provider exclusive chat
* COMPLETED: Chat remains read-only for reference
* CANCELED: Chat is locked and archived

**Moderation & Safety**

* Admins can mute, suspend, or archive chat per query
* All messages are stored with timestamps and user metadata
* Chat logs are part of the platform audit trail

---

## 5. Workflow & Status Definitions

| Status    | Meaning                             | Provider Access     |
| --------- | ----------------------------------- | ------------------- |
| OPEN      | New query, matching in progress     | View & Quote        |
| ACTIVE    | Quotes received, customer comparing | Chat & Update Quote |
| ACCEPTED  | Provider selected                   | Exclusive Chat      |
| COMPLETED | Job delivered                       | Review-only         |
| CANCELED  | Query withdrawn                     | Access revoked      |

**Rules**

* Customer can cancel anytime before completion
* Once customer accepted anyone providers bid then other provider cannot acces this query and chats are not allowed to this customer until they are connecting with new query again
* Once canceled, no new quotes or chats are allowed
* Query can be marked **COMPLETED only by the customer** 

---

## 6. Technical Specifications

### 6.1 Core Tech Stack

| Layer    | Technology                                   |
| -------- | -------------------------------------------- |
| Frontend | React                                        |
| Backend  | Firebase (Firestore, Auth, Storage, message) |
| Location | Google Places Autocomplete & Geocoding       |

---

### 6.2 Security & Compliance

| Area           | Measure                                                           |
| -------------- | ----------------------------------------------------------------- |
| Identity       | IP & device anomaly alerts                                        |
| Auditability   | Logs for status change, quote edits, cancellations, admin actions |
| Data Integrity | Strict Firestore security rules                                   |
| Access Control | Role-based permissions                                            |

---

## 7. UI / UX Principles – “UAE Premium Standard”

| Aspect        | Specification                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| Primary Color | Royal Purple #5B3D9D                                                                                                |
| Secondary     | Dubai Gold #FFD60A                                                                                                  |
| Accents       | Pink #FF69B4 (urgency), Green #8BC34A (success)                                                                     |
| Typography    | Sentence case text (only first letter capitalized), Proper nouns capitalized; bold-only headings, modern sans-serif |
| Layout        | Curved cards (2.5–3.5rem radius)                                                                                    |
| Design Goal   | Executive, clean, high-trust aesthetic                                                                              |

---

## 8. Services we onboarded in platform 

* Visa Services / Business Setup (Company Formation & PRO)
* Tours & Travels (Corporate & Personal)
* Packers and Movers (Relocation Experts)
* Marketing / Payroll Service (Operational Outsourcing)
* Home Service (Maintenance & Luxury Care)
* Book Keeping / Tax Consultant / Audit (Financial Integrity)
* Car Lift (Professional Commute)
* Rent a Car (Elite Fleet Services)


----



**PRD Owner:** Raj
**Version:** v1.2
**Status:** Approved for Design & Engineering
