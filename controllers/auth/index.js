// Auth controllers index file
// Exports all authentication-related controller functions

const { register } = require('./register');
const { logout } = require('./logout');
const { registerCashier } = require('./registerCashier');
const { login } = require('./login');
const { checkEmail } = require('./checkEmail');
const { resetPassword } = require('./resetPassword');
const { resetPasswordVerify } = require('./resetPasswordVerify');
const { cashierLogout } = require('./cashierLogout');

module.exports = {
  register,
  logout,
  registerCashier,
  login,
  checkEmail,
  resetPassword,
  resetPasswordVerify,
  cashierLogout,
};
