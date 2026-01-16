const fetch = require('node-fetch');

/**
 * Sends a targeted push notification to a specific user via OneSignal
 * @param {string} createdAtKey - The unique ID stored in the user's profile
 * @param {string} title - Notification title
 * @param {string} message - Notification message body
 * @param {Object} data - Optional additional data for the notification
 */
async function sendTargetedNotification(createdAtKey, title, message, data = {}) {
  try {
    console.log('sendTargetedNotification called with:', { createdAtKey, title });
    if (!process.env.ONE_SIGNAL_APP_ID || !process.env.ONE_SIGNAL_API_KEY) {
      console.warn('OneSignal credentials missing:', { 
        appId: !!process.env.ONE_SIGNAL_APP_ID, 
        apiKey: !!process.env.ONE_SIGNAL_API_KEY 
      });
      return;
    }

    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ONE_SIGNAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: process.env.ONE_SIGNAL_APP_ID,
        include_aliases: {
          external_id: [createdAtKey]
        },
        target_channel: 'push',
        headings: { en: title },
        contents: { en: message },
        data: data
      })
    };

    console.log('Sending notification to user:', createdAtKey);
    console.log('Notification options:', options);

    const response = await fetch('https://api.onesignal.com/notifications', options);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(`OneSignal API Error: ${JSON.stringify(result)}`);
    }

    console.log(`Notification sent to user ${createdAtKey}:`, result);
    return result;
  } catch (error) {
    console.error('Error sending OneSignal notification:', error);
    throw error;
  }
}

module.exports = { sendTargetedNotification };
