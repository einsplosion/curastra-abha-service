# Curastra ABHA Microservice - Stateless API Integration Guide

This guide provides technical documentation for integrating the **Curastra ABHA Stateless Gateway Microservice** into any backend application (Node.js, Python/FastAPI, Java, Go, etc.).

---

## 1. Architecture Overview

The **Curastra ABHA Microservice** is a **100% Stateless Gateway**. It does **NOT** connect to any database.

* **Responsibility of Microservice:**
  * Manages ABDM V3 Gateway authentication tokens.
  * Encrypts sensitive data (Aadhaar & OTP) using RSA-OAEP SHA-1.
  * Calls ABDM Gateway V3 endpoints directly from Azure Central India (Pune).
  * Returns raw verified ABHA credentials to the calling backend.
* **Responsibility of Calling Backend:**
  * Validates user authentication.
  * Calls `/api/abha/enroll/initiate` with `aadhaarNumber`.
  * Calls `/api/abha/enroll/verify` with `txnId` and `otp`.
  * Saves returned `abhaNumber` and `abhaAddress` into its own database (e.g. `profiles` or `users` table).

---

## 2. Base URL & Deployment Information

* **Production Base URL:** `https://curastra-abha-service-ewgafcb5eed8ccby.centralindia-01.azurewebsites.net`
* **Region:** Central India
* **API Standard:** ABDM V3 Compliant

---

## 3. Authentication

All requests to the `/api/abha/*` endpoints require a valid user **JWT Bearer Token** in the `Authorization` header.

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

---

## 4. API Endpoints Overview

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Health Check & Service Status | No |
| `POST` | `/api/abha/enroll/initiate` | Triggers Aadhaar OTP for ABHA creation | Yes |
| `POST` | `/api/abha/enroll/verify` | Verifies OTP and returns ABHA credentials | Yes |

---

## 5. Detailed Endpoint Specifications

### 5.1. Health Check Endpoint
Checks microservice availability and status.

* **URL:** `GET /health`
* **Headers:** None

#### Response (`200 OK`)
```json
{
  "status": "ok",
  "service": "curastra-abha-microservice",
  "location": "India Region",
  "timestamp": "2026-08-05T01:36:36.000Z"
}
```

---

### 5.2. Initiate ABHA Enrollment (Send Aadhaar OTP)
Triggers an OTP sent to the user's Aadhaar-linked mobile number via ABDM Gateway.

* **URL:** `POST /api/abha/enroll/initiate`
* **Headers:**
  * `Authorization: Bearer <JWT_TOKEN>`
  * `Content-Type: application/json`

#### Request Body
```json
{
  "aadhaarNumber": "123456789012"
}
```

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `aadhaarNumber` | String | **Yes** | Exactly 12 digits (numbers only) |

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "OTP sent to Aadhaar-linked mobile number",
  "data": {
    "txnId": "3453a9f0-8c91-42ef-91aa-4927b10294fe"
  }
}
```

#### Error Responses
* **`400 Bad Request`**: Validation error (e.g. invalid 12-digit Aadhaar format).
* **`401 Unauthorized`**: Invalid or missing JWT token.
* **`500 Internal Server Error`**: ABDM Gateway connection failure.

---

### 5.3. Verify OTP & Return ABHA Credentials
Verifies the OTP with ABDM Gateway and returns the user's ABHA credentials.

* **URL:** `POST /api/abha/enroll/verify`
* **Headers:**
  * `Authorization: Bearer <JWT_TOKEN>`
  * `Content-Type: application/json`

#### Request Body
```json
{
  "txnId": "3453a9f0-8c91-42ef-91aa-4927b10294fe",
  "otp": "123456",
  "mobileNumber": "9876543210"
}
```

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `txnId` | String | **Yes** | `txnId` returned from `/enroll/initiate` |
| `otp` | String | **Yes** | 6-digit OTP received on mobile |
| `mobileNumber` | String | Optional | 10-digit mobile number |

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "ABHA enrollment verified successfully.",
  "data": {
    "abhaNumber": "12-3456-7890-1234",
    "abhaAddress": "user@sbx",
    "name": "Anurag Sharma",
    "isNew": false
  }
}
```

---

## 6. Integration Examples

### 6.1. Node.js (Axios) Integration Example

```javascript
const axios = require("axios");

const ABHA_SERVICE_URL = process.env.ABHA_SERVICE_URL || "https://curastra-abha-service-ewgafcb5eed8ccby.centralindia-01.azurewebsites.net";

/**
 * Step 1: Request Aadhaar OTP
 */
const initiateAbha = async (userJwt, aadhaarNumber) => {
  const res = await axios.post(
    `${ABHA_SERVICE_URL}/api/abha/enroll/initiate`,
    { aadhaarNumber },
    { headers: { Authorization: `Bearer ${userJwt}` } }
  );
  return res.data; // { success: true, data: { txnId: "..." } }
};

/**
 * Step 2: Verify OTP & Save to Your DB
 */
const verifyAndSaveAbha = async (userJwt, txnId, otp, profileId) => {
  const res = await axios.post(
    `${ABHA_SERVICE_URL}/api/abha/enroll/verify`,
    { txnId, otp },
    { headers: { Authorization: `Bearer ${userJwt}` } }
  );

  const { abhaNumber, abhaAddress } = res.data.data;

  // Save to your database (PostgreSQL Node.js)
  await db.query(
    `UPDATE profiles SET abha_number = $1, abha_address = $2, abha_linked = TRUE WHERE id = $3`,
    [abhaNumber, abhaAddress, profileId]
  );

  return res.data.data;
};
```

---

## 7. Recommended Security Best Practices & Database Invariants

Since the ABHA Microservice is a **stateless gateway**, the calling backend (Node.js or Python) **MUST** implement the following two critical security checks in its own service layer:

### 7.1. Profile Ownership & Pre-Validation (`resolveAndVerifyProfile`)

Before calling the microservice endpoints (`/enroll/initiate` or `/enroll/verify`), the backend must verify:
1. **Ownership Check:** The target `profile_id` belongs to the authenticated `user_id` (`WHERE id = profile_id AND owner_user_id = user_id`).
2. **Already Linked Check:** If `profile.abha_linked === true`, reject the request immediately (`409 Conflict`) to prevent redundant ABDM Gateway calls.

#### Node.js Helper Example:
```javascript
const resolveAndVerifyProfile = async (userId, profileId) => {
  const result = await db.query(
    `SELECT id, abha_linked FROM profiles WHERE id = $1 AND owner_user_id = $2`,
    [profileId, userId]
  );

  if (result.rows.length === 0) {
    const error = new Error("Target profile not found or access denied.");
    error.status = 404;
    throw error;
  }

  const profile = result.rows[0];
  if (profile.abha_linked) {
    const error = new Error("This profile is already linked to an ABHA number.");
    error.status = 409;
    throw error;
  }

  return profile;
};
```

---

### 7.2. ABHA Uniqueness Check (`checkAbhaAvailability`)

ABHA numbers uniquely identify a single individual in India. Before linking a newly received `abhaNumber` to a profile, your backend must verify that the `abhaNumber` is not already linked to another user's profile:

1. Query database: `SELECT id FROM profiles WHERE abha_number = $1`
2. If another profile already holds this `abha_number`, reject with `409 Conflict`.
3. Database constraint: Define `abha_number TEXT UNIQUE` on your `profiles` (or `users`) table.

#### Node.js Helper Example:
```javascript
const checkAbhaAvailability = async (abhaNumber) => {
  const result = await db.query(
    `SELECT id FROM profiles WHERE abha_number = $1`,
    [abhaNumber]
  );

  if (result.rows.length > 0) {
    const error = new Error("This ABHA number is already linked to another profile in the system.");
    error.status = 409;
    throw error;
  }
};
```

---

### 7.3. Complete Secure Integration Flow (Node.js)

Putting it all together in your backend service handler:

```javascript
const linkAbhaToProfile = async (userJwt, userId, profileId, txnId, otp) => {
  // 1. Security Check: Verify Profile Ownership & Status
  await resolveAndVerifyProfile(userId, profileId);

  // 2. Stateless Call: Verify OTP with ABHA Microservice
  const abhaData = await verifyAbhaWithMicroservice(userJwt, txnId, otp);

  // 3. Security Check: Ensure ABHA Number is not duplicated
  await checkAbhaAvailability(abhaData.abhaNumber);

  // 4. Persistence: Update Database
  await db.query(
    `UPDATE profiles SET abha_number = $1, abha_address = $2, abha_linked = TRUE WHERE id = $3`,
    [abhaData.abhaNumber, abhaData.abhaAddress, profileId]
  );

  return abhaData;
};
```
