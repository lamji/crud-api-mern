const { validationResult } = require('express-validator');
const Profile = require('../../models/Profile');

/**
 * @desc    Add address to profile
 * @route   POST /api/profile/addresses
 * @access  Private
 */
exports.addAddress = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { type, street, barangay, city, province, region, zipCode, country, phone, nearestLandmark, isDefault } = req.body;

    // Convert type to lowercase if provided
    const normalizedType = type ? type.toLowerCase() : 'home';

    // 1. Check if user already has a default address and trying to add another
    if (isDefault) {
      const profileWithDefault = await Profile.findOne({ 
        userId: req.user.id,
        "addresses.isDefault": true 
      });

      if (profileWithDefault) {
        return res.status(400).json({
          success: false,
          message: 'You already have a default address. Please update the existing default address instead.'
        });
      }
    }

    // 2. Add new address atomically
    const profile = await Profile.findOneAndUpdate(
      { 
        userId: req.user.id
      },
      { 
        $push: { 
          addresses: { 
            type: normalizedType,
            street,
            barangay,
            city,
            province,
            region,
            zipCode,
            country,
            phone,
            nearestLandmark,
            isDefault: !!isDefault
          } 
        } 
      },
      { new: true, runValidators: true }
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    const newAddress = profile.addresses[profile.addresses.length - 1];

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: newAddress
    });
  } catch (error) {
    console.error('Error adding address:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
