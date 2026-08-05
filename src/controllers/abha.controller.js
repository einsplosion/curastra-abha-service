const abhaService = require("../services/abha.service.js");

exports.enrollInitiate = async (req, res, next) => {
  try {
    const { aadhaarNumber } = req.body;

    const result = await abhaService.enrollmentRequestOtp(aadhaarNumber);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: { txnId: result.txnId },
    });
  } catch (err) {
    next(err);
  }
};

exports.enrollVerify = async (req, res, next) => {
  try {
    const { txnId, otp, mobileNumber } = req.body;
    
    const result = await abhaService.enrolByAadhaar(
      txnId,
      otp,
      mobileNumber
    );

    return res.status(200).json({
      success: true,
      message: "ABHA enrollment verified successfully.",
      data: {
        abhaNumber: result.abhaNumber,
        abhaAddress: result.abhaAddress,
        name: result.name,
        isNew: result.isNew,
      },
    });
  } catch (err) {
    next(err);
  }
};
