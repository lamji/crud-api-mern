const Profile = require('../../models/Profile');
const { cacheProfile } = require('./getProfile');

/**
 * @desc    Get multiple profiles (batch operation for admin/scaling)
 * @route   POST /api/profile/batch
 * @access  Private/Admin
 */
exports.getMultipleProfiles = async (req, res) => {
  const startTime = Date.now();
  const { userIds, fields = 'firstName lastName email createdAt' } = req.body;
  
  try {
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User IDs array is required'
      });
    }
    
    if (userIds.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 100 user IDs per request'
      });
    }
    
    // Batch database query with field selection
    const profiles = await Profile.find({
      userId: { $in: userIds }
    }).select(fields)
      .lean();
    
    // Cache individual profiles
    for (const profile of profiles) {
      const cacheKey = `profile:${profile.userId}`;
      await cacheProfile(cacheKey, profile);
    }
    
    console.log(`Batch fetch: ${profiles.length} profiles, response time: ${Date.now() - startTime}ms`);
    
    res.status(200).json({
      success: true,
      data: profiles,
      count: profiles.length,
      responseTime: `${Date.now() - startTime}ms`
    });
    
  } catch (error) {
    console.error('Error fetching multiple profiles:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
