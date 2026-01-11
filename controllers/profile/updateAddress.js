const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Profile = require('../../models/Profile');

/**
 * @desc    Update address
 * @route   PUT /api/profile/addresses/:addressId
 * @access  Private
 */
exports.updateAddress = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { addressId } = req.params;
    const { type, street, barangay, city, province, region, zipCode, country, phone, nearestLandmark, isDefault } = req.body;

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid address ID'
      });
    }

    // Convert type to lowercase if provided
    const normalizedType = type ? type.toLowerCase() : undefined;

    // 1. If setting as default, unset other default addresses first (Atomic update)
    if (isDefault) {
      await Profile.updateOne(
        { userId: req.user.id },
        { $set: { "addresses.$[].isDefault": false } }
      );
    }

    // 2. Build update object atomically
    const updateFields = {};
    const addressUpdatePath = `addresses.$[address]`;
    
    if (normalizedType !== undefined) updateFields[`${addressUpdatePath}.type`] = normalizedType;
    if (street !== undefined) updateFields[`${addressUpdatePath}.street`] = street;
    if (barangay !== undefined) updateFields[`${addressUpdatePath}.barangay`] = barangay;
    if (city !== undefined) updateFields[`${addressUpdatePath}.city`] = city;
    if (province !== undefined) updateFields[`${addressUpdatePath}.province`] = province;
    if (region !== undefined) updateFields[`${addressUpdatePath}.region`] = region;
    if (zipCode !== undefined) updateFields[`${addressUpdatePath}.zipCode`] = zipCode;
    if (country !== undefined) updateFields[`${addressUpdatePath}.country`] = country;
    if (phone !== undefined) updateFields[`${addressUpdatePath}.phone`] = phone;
    if (nearestLandmark !== undefined) updateFields[`${addressUpdatePath}.nearestLandmark`] = nearestLandmark;
    if (isDefault !== undefined) updateFields[`${addressUpdatePath}.isDefault`] = isDefault;

    // 3. Atomic update using arrayFilters
    const updatedProfile = await Profile.findOneAndUpdate(
      { 
        userId: req.user.id,
        "addresses._id": addressId
      },
      { $set: updateFields },
      { 
        new: true,
        arrayFilters: [{ "address._id": addressId }],
        runValidators: true
      }
    );

    if (!updatedProfile) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    const updatedAddress = updatedProfile.addresses.find(a => a._id.toString() === addressId);

    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: updatedAddress
    });
  } catch (error) {
    console.error('Error updating address:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
