const axios = require("axios");
const logger = require("../config/logger.js");
const buildAbhaHeaders = require("../utils/abhaHeaders.js");
const { getGatewayToken } = require("./gatewayToken.service.js");
const { encryptForAbdm } = require("../utils/encryption.js");

// constants
const BASE = process.env.ABDM_BASE_URL;
const ABDM_TIMEOUT = 30000;

// formats current timestamp as "YYYY-MM-DD HH:MM:SS", abdm does not accept ISO
const getSimpleTimestamp = () => {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, "0");
  return (
    now.getFullYear() +
    "-" +
    pad(now.getMonth() + 1) +
    "-" +
    pad(now.getDate()) +
    " " +
    pad(now.getHours()) +
    ":" +
    pad(now.getMinutes()) +
    ":" +
    pad(now.getSeconds())
  );
};

// ENROLLMENT REQUEST OTP
// 1. validate 12-digit Aadhaar number
// 2. encrypt Aadhaar number using RSA-OAEP SHA-1 spec
// 3. call ABDM Gateway to trigger OTP to Aadhaar-linked mobile
// 4. return txnId for Step 2
const enrollmentRequestOtp = async (aadhaarNumber) => {
  if (!aadhaarNumber || aadhaarNumber.length !== 12) {
    const error = new Error("Valid 12-digit Aadhaar number is required");
    error.status = 400;
    throw error;
  }

  try {
    const encryptedAadhaar = await encryptForAbdm(aadhaarNumber);
    const token = await getGatewayToken();

    logger.info("Requesting ABHA enrollment OTP");

    const response = await axios.post(
      `${BASE}/v3/enrollment/request/otp`,
      {
        scope: ["abha-enrol"],
        loginHint: "aadhaar",
        loginId: encryptedAadhaar,
        otpSystem: "aadhaar",
      },
      {
        headers: buildAbhaHeaders(token),
        timeout: ABDM_TIMEOUT,
      }
    );

    return {
      txnId: response.data.txnId,
      message: "OTP sent to Aadhaar-linked mobile number",
    };
  } catch (err) {
    if (err.status && !err.isAxiosError) throw err;

    const rawMessage =
      err.response?.data?.errorDetails?.[0]?.message ||
      err.response?.data?.details?.[0]?.message ||
      err.response?.data?.message ||
      err.message ||
      "Failed to request ABHA OTP. Please try again.";

    const abdmMessage = typeof rawMessage === "string" ? rawMessage : "Failed to request ABHA OTP.";
    const abdmStatus = err.response?.status || err.status || 500;

    const error = new Error(abdmMessage);
    error.status = abdmStatus;
    throw error;
  }
};

// ENROLL BY AADHAAR
// 1. validate inputs (txnId, otp)
// 2. encrypt OTP using RSA-OAEP SHA-1 spec
// 3. submit to ABDM for verification
// 4. extract and return raw ABHA profile payload ({ abhaNumber, abhaAddress, name, isNew })
const enrolByAadhaar = async (txnId, otp, mobile = "") => {
  if (!txnId || !otp) {
    const error = new Error("txnId and OTP are required");
    error.status = 400;
    throw error;
  }

  try {
    const encryptedOtp = await encryptForAbdm(otp);
    const token = await getGatewayToken();

    logger.info("Verifying ABHA enrollment OTP with ABDM");

    const response = await axios.post(
      `${BASE}/v3/enrollment/enrol/byAadhaar`,
      {
        authData: {
          authMethods: ["otp"],
          otp: {
            timeStamp: getSimpleTimestamp(),
            txnId,
            otpValue: encryptedOtp,
            mobile: mobile || "",
          },
        },
        consent: {
          code: "abha-enrollment",
          version: "1.4",
        },
      },
      {
        headers: buildAbhaHeaders(token),
        timeout: ABDM_TIMEOUT,
      }
    );

    const data = response.data;

    const abhaNumber = data?.ABHAProfile?.ABHANumber;
    const abhaAddress = data?.ABHAProfile?.phrAddress?.[0] || null;
    const isNew = data?.isNew || false;
    const name = `${data?.ABHAProfile?.firstName || ""} ${data?.ABHAProfile?.lastName || ""}`.trim();

    if (!abhaNumber) {
      const error = new Error("ABHA enrollment completed but no ABHA number was returned.");
      error.status = 502;
      throw error;
    }

    return {
      abhaNumber,
      abhaAddress,
      isNew,
      name,
    };
  } catch (err) {
    if (err.status && !err.isAxiosError) throw err;

    const rawMessage =
      err.response?.data?.errorDetails?.[0]?.message ||
      err.response?.data?.details?.[0]?.message ||
      err.response?.data?.message ||
      err.message ||
      "Failed to complete ABHA enrollment. Please try again.";

    const abdmMessage = typeof rawMessage === "string" ? rawMessage : "Failed to complete ABHA enrollment.";
    const abdmStatus = err.response?.status || err.status || 500;

    const error = new Error(abdmMessage);
    error.status = abdmStatus;
    throw error;
  }
};

module.exports = {
  enrollmentRequestOtp,
  enrolByAadhaar,
};
