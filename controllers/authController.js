const { register, logout, login, checkEmail, resetPassword, resetPasswordVerify, cashierLogout } = require('./auth');

module.exports = {
  register,
  logout,
  login,
  checkEmail,
  resetPassword,
  resetPasswordVerify,
  cashierLogout,
};
