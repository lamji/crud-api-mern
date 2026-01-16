// Auth controllers index file
// Exports all authentication-related controller functions

const { register } = require('./register');
const { logout } = require('./logout');
const { registerCashier } = require('./registerCashier');
// Add other auth functions here as they are moved
// const { login } = require('./login');
// const { forgotPassword } = require('./forgotPassword');
// const { resetPassword } = require('./resetPassword');

module.exports = {
  register,
  logout,
  registerCashier,
  // Add other exports here
};
