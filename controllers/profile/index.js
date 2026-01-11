const { getProfile } = require('./getProfile');
const { getMultipleProfiles } = require('./getMultipleProfiles');
const { clearProfileCache } = require('./clearProfileCache');
const { updateFullName } = require('./updateFullName');
const { updateProfile } = require('./updateProfile');
const { updateEmail } = require('./updateEmail');
const { sendEmailVerification } = require('./sendEmailVerification');
const { verifyEmail } = require('./verifyEmail');
const { addPhone } = require('./addPhone');
const { updatePhone } = require('./updatePhone');
const { deletePhone } = require('./deletePhone');
const { resetOtpLock } = require('./resetOtpLock');
const { addAddress } = require('./addAddress');
const { updateAddress } = require('./updateAddress');
const { deleteAddress } = require('./deleteAddress');

// Re-export all profile functions for use in routes
module.exports = {
  getProfile,
  updateProfile,
  updateFullName,
  updateEmail,
  sendEmailVerification,
  verifyEmail,
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