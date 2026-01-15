const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Profile = require('../../models/Profile');
const User = require('../../models/User');

/**
 * @desc    Update user profile with phones and addresses
 * @access  Private
 */
exports.updateProfileData = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { phones, addresses } = req.body;
    const userId = req.user.id;

    // Find user profile
    let profile = await Profile.findOne({ userId: userId });
    
    // Get user details for required fields
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (!profile) {
      // Create profile if it doesn't exist
      profile = new Profile({
        userId: userId,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phones: phones ? phones.map(phone => {
          const { id, ...phoneData } = phone; // Remove id field
          return phoneData;
        }) : [],
        addresses: addresses ? addresses.map(addr => {
          const { id, ...addrData } = addr; // Remove id field
          return {
            ...addrData,
            phone: phones && phones.length > 0 ? phones[0].number : '' // Add required phone field
          };
        }) : []
      });
    } else {
      // Update existing profile
      if (phones) {
        profile.phones = phones.map(phone => {
          const { id, ...phoneData } = phone; // Remove id field
          return phoneData;
        });
      }
      if (addresses) {
        profile.addresses = addresses.map(addr => {
          const { id, ...addrData } = addr; // Remove id field
          return {
            ...addrData,
            phone: phones && phones.length > 0 ? phones[0].number : '' // Add required phone field
          };
        });
      }
    }

    // Save the updated profile
    await profile.save();

    // Update user's profile completion status
    const hasPhones = phones && phones.length > 0 && phones.some(phone => phone.number.trim() !== '');
    const hasAddresses = addresses && addresses.length > 0 && addresses.some(addr => 
      addr.street.trim() !== '' && 
      addr.barangay.trim() !== '' && 
      addr.city.trim() !== '' && 
      addr.province.trim() !== '' && 
      addr.region.trim() !== '' && 
      addr.zipCode.trim() !== '' && 
      addr.country.trim() !== ''
    );
    
    user.profileCompleted = hasPhones && hasAddresses;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        phones: profile.phones,
        addresses: profile.addresses,
        profileCompleted: user.profileCompleted
      }
    });

  } catch (error) {
    console.error('Update profile data error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
