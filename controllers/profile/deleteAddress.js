const mongoose = require('mongoose');
const Profile = require('../../models/Profile');

/**
 * @desc    Delete address
 * @route   DELETE /api/profile/addresses/:addressId
 * @access  Private
 */
exports.deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid address ID'
      });
    }

    // 1. Find the profile and get the address to be deleted (for response data)
    const profile = await Profile.findOne({ userId: req.user.id });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    const addressToDelete = profile.addresses.find(address => address._id.toString() === addressId);
    
    if (!addressToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Check if the address to be deleted is default
    if (addressToDelete.isDefault) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete default address. Please set another address as default first.'
      });
    }

    // 2. Atomic delete operation
    const updatedProfile = await Profile.findOneAndUpdate(
      { 
        userId: req.user.id,
        "addresses._id": addressId
      },
      { 
        $pull: { addresses: { _id: addressId } }
      },
      { new: true }
    );

    if (!updatedProfile) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting address:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
