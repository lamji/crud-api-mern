const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Profile = require('../../models/Profile');

/**
 * @desc    Update phone number
 * @route   PUT /api/profile/phones/:phoneId
 * @access  Private
 */
exports.updatePhone = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { phoneId } = req.params;
    const { type, number, isPrimary } = req.body;

    if (!mongoose.Types.ObjectId.isValid(phoneId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone ID'
      });
    }

    const trimmedNumber = number ? number.trim() : null;

    // 1. Check if phone number already exists (excluding current phone)
    if (trimmedNumber) {
      const existingPhone = await Profile.findOne({
        userId: req.user.id,
        "phones.number": trimmedNumber,
        "phones._id": { $ne: phoneId }
      });

      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'This phone number already exists in your profile'
        });
      }
    }

    // 2. If setting as primary, unset other primary phones first (Atomic update)
    if (isPrimary) {
      await Profile.updateOne(
        { userId: req.user.id },
        { $set: { "phones.$[].isPrimary": false } }
      );
    }

    // 3. Build update object atomically
    const updateFields = {};
    const phoneUpdatePath = `phones.$[phone]`;
    
    if (type) updateFields[`${phoneUpdatePath}.type`] = type;
    if (trimmedNumber) updateFields[`${phoneUpdatePath}.number`] = trimmedNumber;
    if (isPrimary !== undefined) updateFields[`${phoneUpdatePath}.isPrimary`] = isPrimary;

    // 4. Atomic update using arrayFilters
    const updatedProfile = await Profile.findOneAndUpdate(
      { 
        userId: req.user.id,
        "phones._id": phoneId
      },
      { $set: updateFields },
      { 
        new: true,
        arrayFilters: [{ "phone._id": phoneId }],
        runValidators: true
      }
    );

    if (!updatedProfile) {
      return res.status(404).json({
        success: false,
        message: 'Phone number not found'
      });
    }

    const updatedPhone = updatedProfile.phones.find(p => p._id.toString() === phoneId);

    res.status(200).json({
      success: true,
      message: 'Phone number updated successfully',
      data: updatedPhone
    });
  } catch (error) {
    console.error('Error updating phone:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
