const { validationResult } = require('express-validator');
const Profile = require('../../models/Profile');

/**
 * @desc    Update user profile
 * @route   PUT /api/profile
 * @access  Private
 */
exports.updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const updatableFields = [
      'firstName', 'lastName', 'phones', 'avatar', 
      'dateOfBirth', 'gender', 'bio', 'preferences',
      'addresses', 'paymentMethods'
    ];

    const updateData = {};
    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const profile = await Profile.findOneAndUpdate(
      { userId: req.user.id },
      { $set: updateData },
      { new: true, runValidators: true, upsert: true }
    ).select('-__v -updatedAt -_id -userId'); // Exclude ID fields

    // Remove ID fields from response if they exist
    const { _id, userId: removedUserId, ...profileResponse } = profile.toObject ? profile.toObject() : profile;

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: profileResponse
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
