# my final draft PRD
strictly no changes without my permissions

## Product Requirements Document (PRD)

---

## 1. Executive Summary

TownHall UAE is a premium B2C and B2B digital services marketplace designed to connect high-intent customers with verified, licensed service providers (Home Services, PROs, Business Consultants, Visa Experts, Legal, Travel, etc.).  

The platform is built on three non-negotiables:

- **Trust-first interactions** through mandatory provider verification  
- **Speed-driven lead matching** using geo-based phased expansion  
- **Transparency-by-design** with audit-ready workflows  

TownHall positions itself as a "Premium Dubai" marketplace — fast, elegant, regulated, and reliable.

---

## 2. Strategic Objectives

| Objective             | Description                                                   |
|----------------------|---------------------------------------------------------------|
| Localized Trust       | Prioritize providers within 3–15 km for faster, accountable service |
| Pricing Transparency  | Enable competitive discovery via multi-quote bidding         |
| Operational Integrity | Maintain complete audit trails for compliance & safety       |
| UAE Premium Experience| Deliver a luxury, executive-grade UI aligned with Dubai standards |

---

## 3. User Roles & Access Control

| Role     | Responsibility                        | Core Access                                      |
|----------|--------------------------------------|-------------------------------------------------|
| Customer | Post queries, compare quotes, hire providers | Dashboard, Query Creator, Quotes, Chat, Profile |
| Provider | Receive leads, submit quotes, manage storefront | Lead Board, Quote Center, Storefront, Chat      |
| Admin    | Platform governance & quality control | Audit Logs, User Directory, Broadcast Center, Matching Rules |

---

## 4. Functional Requirements

### 4.1 Lead Engine (Geo-Based Dynamic Matching)

The Lead Engine ensures local-first discovery with controlled expansion.

**Phase-based Matching Logic**

| Phase    | Time Window | Radius  | Behavior                    |
|----------|------------|--------|-----------------------------|
| Phase 1  | 0–2 mins   | 0–3 km | Notify all eligible providers |
| Phase 2  | 3–4 mins   | 3.5–8 km | Triggered if < 7 quotes     |
| Phase 3  | 5+ mins    | 8.1–15 km | Triggered if < 7 total quotes |


**Threshold Rationale**

- 7 quotes = healthy comparison set without overload  
- 15 quotes = saturation limit; marginal value drops beyond this

**Customer Control Rule**

- If ≥ 7 quotes are received at any phase, customer is prompted to approve further expansion  
- If declined, lead matching permanently stops

**Hard Constraint**

- System must never match beyond 15 km

---

### 4.3 High-Trust Messaging System

Messaging is designed for accountability, not noise.

**Rules & Features**

- Chat unlocks only after a provider submits a quote  
- Customers can chat with multiple providers before acceptance  
- Rich media support for document & site verification  
- Real-time typing indicators and read receipts  
- Admin moderation controls: mute, suspend, or revoke chat access per query

---

### 4.4 Provider Storefront System

Each provider maintains a public-facing, credibility-first storefront.

| Element             | Description                                  |
|-------------------|----------------------------------------------|
| Business Profile    | Verified company name & license status      |
| Service Stream      | Tagged, verified service categories         |
| Portfolio           | Image-based proof of previous work          |
| Performance Metrics | Avg rating (5★), median response time, total jobs completed |

---

## 5. Workflow & Status Definitions

| Status     | Meaning                         | Provider Access        |
|-----------|---------------------------------|----------------------|
| OPEN      | New query, matching in progress | View & Quote         |
| ACTIVE    | Quotes received, customer comparing | Chat & Update Quote |
| ACCEPTED  | Provider selected               | Exclusive Chat       |
| COMPLETED | Job delivered                   | Review-only          |
| CANCELED  | Query withdrawn                 | Access revoked       |

**Rules**

- Customer can cancel anytime before completion  
- Once canceled, no new quotes or chats are allowed  
- Query can be marked COMPLETED only by the customer after service delivery

---

## 6. Technical Specifications

### 6.1 Core Tech Stack

| Layer    | Technology                                      |
|---------|-------------------------------------------------|
| Frontend | React         |
| Backend  | Firebase (Firestore, Auth, Storage, Message)           |
| Location | Google Places Autocomplete & Geocoding         |

### 6.2 Security & Compliance

| Area          | Measure                                           |
|--------------|---------------------------------------------------|
| Identity      | IP & device anomaly alerts                        |
| Auditability  | Logs for status change, quote edits, cancellations, post Query, matching providers, admin actions |
| Data Integrity| Strict Firestore security rules                   |
| Access Control| Role-based permissions                            |

---

## 7. UI / UX Principles – “UAE Premium Standard”

| Aspect       | Specification                                                            |
|-------------|--------------------------------------------------------------------------|
| Primary Color| Royal Purple #5B3D9D                                                    |
| Secondary    | Dubai Gold #FFD60A                                                       |
| Accents      | Pink #FF69B4 (urgency), Green #8BC34A (success)                        |
| Typography   | Sentence case text (only first letter capitalized), Proper nouns capitalized; bold-only headings, modern sans-serif |
| Layout       | Curved cards (2.5–3.5rem radius)                                        |
| Design Goal  | Executive, clean, high-trust aesthetic, with material icons.                                  |

---

**PRD Owner:** Raj  
**Version:** v1.2  
**Status:** Approved for Design & Engineering
