const { validationResult } = require('express-validator');
const Profile = require('../../models/Profile');

/**
 * @desc    Update user full name (single string)
 * @route   PUT /api/profile/fullname
 * @access  Private
 */
exports.updateFullName = async (req, res) => {
  try {
    const { firstName, lastName } = req.body;

    if (!firstName || typeof firstName !== 'string' || firstName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'First name is required and must be a non-empty string'
      });
    }

    // Validate lastName if provided
    if (lastName && (typeof lastName !== 'string' || lastName.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Last name must be a non-empty string if provided'
      });
    }

    const profile = await Profile.findOneAndUpdate(
      { userId: req.user.id },
      { 
        $set: { 
          firstName: firstName.trim(),
          lastName: lastName ? lastName.trim() : ''
        }
      },
      { new: true, runValidators: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Name updated successfully',
      data: profile
    });
  } catch (error) {
    console.error('Error updating name:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
