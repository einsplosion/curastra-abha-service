const abhaService = require("../services/abha.service.js");

exports.enrollInitiate = async (req, res, next) => {
  try {
    const { aadhaarNumber, profile_id } = req.body;

    const result = await abhaService.enrollmentRequestOtp(
      req.user.id,
      aadhaarNumber,
      profile_id
    );

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
    const { txnId, otp, mobileNumber, profile_id } = req.body;
    
    const result = await abhaService.enrolByAadhaar(
      req.user.id,
      txnId,
      otp,
      mobileNumber,
      profile_id
    );

    return res.status(200).json({
      success: true,
      message: "ABHA card linked successfully.",
      data: {
        abhaNumber: result.abhaNumber,
        abhaAddress: result.abhaAddress,
        name: result.name,
        isNew: result.isNew,
        profile_id: result.profile.id,
      },
    });
  } catch (err) {
    next(err);
  }
};
