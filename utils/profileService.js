const Profile = require('../models/Profile');

/**
 * Creates a default profile for a new user
 * @param {Object} user - The user object from the database
 * @param {string} fullName - The full name provided during registration
 * @param {string} oneSignalUserId - The generated oneSignalUserId
 * @param {Object} [session] - Optional mongoose session for transactions
 */
async function createDefaultProfile(user, fullName, oneSignalUserId, session = null) {
  try {
    const firstName = fullName.split(' ')[0] || fullName;
    const lastName = fullName.split(' ').slice(1).join(' ') || ' '; // Default to empty string if no last name

    const profileData = {
      userId: user._id,
      firstName,
      lastName,
      email: user.email,
      oneSignalUserId,
      emailVerified: user.emailVerified || true,
      emailVerifiedAt: user.emailVerified ? new Date() : null,
      preferences: {
        newsletter: false,
        smsNotifications: false,
        pushNotifications: false,
        language: 'en',
        currency: 'PHP'
      },
      stats: {
        totalOrders: 0,
        totalSpent: 0,
        averageOrderValue: 0,
        favoriteCategories: [],
        loyaltyPoints: 0,
        memberSince: new Date()
      },
      phones: [],
      addresses: [],
      paymentMethods: [],
      orders: []
    };

    if (session) {
      return await Profile.create([profileData], { session });
    }
    return await Profile.create(profileData);
  } catch (error) {
    console.error('Error creating default profile:', error);
    throw error;
  }
}

module.exports = {
  createDefaultProfile
};
