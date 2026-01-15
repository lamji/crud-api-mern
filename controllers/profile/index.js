const { getProfile } = require('./getProfile');
const { getMultipleProfiles } = require('./getMultipleProfiles');
const { clearProfileCache } = require('./clearProfileCache');
const { updateFullName } = require('./updateFullName');
const { updateProfile } = require('./updateProfile');
const { updateEmail } = require('./updateEmail');
const { sendEmailVerification } = require('./sendEmailVerification');
const { verifyEmail } = require('./verifyEmail');
const { resendOtp } = require('./sendEmailVerification');
const { addPhone } = require('./addPhone');
const { updatePhone } = require('./updatePhone');
const { deletePhone } = require('./deletePhone');
const { resetOtpLock } = require('./resetOtpLock');
const { addAddress } = require('./addAddress');
const { updateAddress } = require('./updateAddress');
const { deleteAddress } = require('./deleteAddress');
const { updateProfileData } = require('./updateProfileData');

// Re-export all profile functions for use in routes
module.exports = {
  getProfile,
  updateProfile,
  updateProfileData,
  updateFullName,
  updateEmail,
  sendEmailVerification,
  verifyEmail,
  resendOtp,
  addPhone,
  updatePhone,
  deletePhone,
  getMultipleProfiles,
  clearProfileCache,
  resetOtpLock,
  addAddress,
  updateAddress,
  deleteAddress
};