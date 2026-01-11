const { validationResult } = require('express-validator');
const Profile = require('../../models/Profile');

/**
 * @desc    Add phone number to profile
 * @route   POST /api/profile/phones
 * @access  Private
 */
exports.addPhone = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { type, number, isPrimary } = req.body;

    // Basic phone number validation
    const phoneRegex = /^[+]?[\d\s\-\(\)]+$/;
    if (!phoneRegex.test(number.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number'
      });
    }

    const trimmedNumber = number.trim();

    // 0. Check if phone number already exists in the profile
    const existingProfile = await Profile.findOne({ 
      userId: req.user.id,
      "phones.number": trimmedNumber 
    });

    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: 'This phone number already exists in your profile'
      });
    }

    // 1. Check if user already has a primary phone and trying to add another
    if (isPrimary) {
      const profileWithPrimary = await Profile.findOne({ 
        userId: req.user.id,
        "phones.isPrimary": true 
      });

      if (profileWithPrimary) {
        return res.status(400).json({
          success: false,
          message: 'You already have a primary phone number. Please update the existing primary phone instead.'
        });
      }
    }

    // 2. Add new phone atomically
    const profile = await Profile.findOneAndUpdate(
      { 
        userId: req.user.id
      },
      { 
        $push: { 
          phones: { 
            type: type || 'mobile', 
            number: trimmedNumber, 
            isPrimary: !!isPrimary 
          } 
        } 
      },
      { new: true, runValidators: true }
    );

    if (!profile) {
      // Check if it's a duplicate or profile not found
      const exists = await Profile.findOne({ userId: req.user.id });
      if (!exists) {
        return res.status(404).json({
          success: false,
          message: 'Profile not found'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'This phone number already exists in your profile'
      });
    }

    const newPhone = profile.phones.find(p => p.number === trimmedNumber);

    res.status(201).json({
      success: true,
      message: 'Phone number added successfully',
      data: newPhone
    });
  } catch (error) {
    console.error('Error adding phone:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
