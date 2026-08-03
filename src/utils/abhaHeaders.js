const { v4: uuidv4 } = require("uuid");

const buildAbhaHeaders = (token) => {
  return {
    Authorization: `Bearer ${token}`,
    "REQUEST-ID": uuidv4(),
    TIMESTAMP: new Date().toISOString(),
    "X-CM-ID": "sbx",
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
};

module.exports = buildAbhaHeaders;
