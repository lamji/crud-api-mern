const mongoose = require('mongoose');
const Profile = require('../../models/Profile');

/**
 * @desc    Delete phone number
 * @route   DELETE /api/profile/phones/:phoneId
 * @access  Private
 */
exports.deletePhone = async (req, res) => {
  try {
    const { phoneId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(phoneId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone ID'
      });
    }

    // 1. Find the profile and get the phone to be deleted (for response data)
    const profile = await Profile.findOne({ userId: req.user.id });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    const phoneToDelete = profile.phones.find(phone => phone._id.toString() === phoneId);
    
    if (!phoneToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Phone number not found'
      });
    }

    // Check if the phone to be deleted is primary
    if (phoneToDelete.isPrimary) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete primary phone number. Please set another phone as primary first.'
      });
    }

    // 2. Atomic delete operation
    const updatedProfile = await Profile.findOneAndUpdate(
      { 
        userId: req.user.id,
        "phones._id": phoneId
      },
      { 
        $pull: { phones: { _id: phoneId } }
      },
      { new: true }
    );

    if (!updatedProfile) {
      return res.status(404).json({
        success: false,
        message: 'Phone number not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Phone number deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting phone:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
