const nodemailer = require('nodemailer');

// Helper function to format date as mm/dd/yy-hh-mm-ss
const formatDate = (date = new Date()) => {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${month}/${day}/${year}-${hours}-${minutes}-${seconds}`;
};

// Helper function for red error logging
const logError = (message) => {
  console.log(`\x1b[31m[${formatDate()}] - ${message}\x1b[0m`);
};

/**
 * Create email transporter based on service configuration
 */
function createTransporter() {
  if (!process.env.EMAIL_SERVICE || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn(`[${formatDate()}] - ⚠️  Email service not configured. Please set EMAIL_SERVICE, EMAIL_USER, and EMAIL_PASS environment variables.`);
    return null;
  }

  let transporter;
  
  if (process.env.EMAIL_SERVICE === 'gmail') {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } else if (process.env.EMAIL_SERVICE === 'ethereal') {
    // For testing - would need async function to create test account
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } else if (process.env.EMAIL_SERVICE === 'namecheap') {
    transporter = nodemailer.createTransport({
      host: 'mail.privateemail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } else {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  return transporter;
}

/**
 * Send payment confirmation email
 */
async function sendPaymentConfirmation(userEmail, userName, orderData) {
  try {
    console.log(`[${formatDate()}] - 📧 Sending payment confirmation email to ${userEmail}`);
    
    const transporter = createTransporter();
    if (!transporter) {
      console.log(`[${formatDate()}] - ⚠️  Email service not available - skipping payment confirmation email`);
      return false;
    }

    const emailContent = {
      from: `"${process.env.STORE_NAME}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `Payment Confirmed - Order ${orderData.orderNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #4CAF50; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Payment Confirmed! 🎉</h1>
          </div>
          
          <div style="padding: 30px 20px;">
            <h2 style="color: #333;">Hi ${userName || 'Customer'},</h2>
            <p style="color: #666; line-height: 1.6;">
              Great news! Your payment has been successfully processed and your order is now being prepared.
            </p>
            
            <div style="background: #f8f9fa; border-left: 4px solid #4CAF50; padding: 20px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #333;">Order Summary</h3>
              <p style="margin: 5px 0;"><strong>Order Number:</strong> ${orderData.orderNumber}</p>
              <p style="margin: 5px 0;"><strong>Total Amount:</strong> ₱${orderData.totalAmount}</p>
              <p style="margin: 5px 0;"><strong>Payment Method:</strong> ${orderData.paymentMethod?.type || 'Online'}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #4CAF50; font-weight: bold;">Processing</span></p>
            </div>
            
            ${orderData.items && orderData.items.length > 0 ? `
              <div style="margin: 20px 0;">
                <h3 style="color: #333;">Items Ordered:</h3>
                ${orderData.items.map((item, index) => {
                  console.log(`[${formatDate()}] - 🖼️ EMAIL IMAGE DEBUG | Item ${index + 1}: ${item.productName} | Image: ${item.productImage || 'UNDEFINED'}`);
                  return `
                  <div style="border-bottom: 1px solid #eee; padding: 15px 0; display: flex; align-items: center; gap: 15px;">
                    ${item.productImage ? `
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="60" style="width: 60px; min-width: 60px;">
                        <tr>
                          <td style="padding: 0; margin: 0; width: 60px; height: 60px; line-height: 0; font-size: 0;">
                            <img src="${item.productImage || 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQrkPJSQhsjlfJZymbIcwLtj_F0ONvYfYfzAQ&s'}" 
                                 alt="${item.productName || 'Product'}" 
                                 width="60" 
                                 height="60" 
                                 style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd; display: block;"
                                 border="0">
                          </td>
                        </tr>
                      </table>
                    ` : `
                      <div style="width: 60px; height: 60px; background: #f5f5f5; border-radius: 8px; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center; color: #999; font-size: 12px; text-align: center;">
                        No Image
                      </div>
                    `}
                    <div style="flex: 1;">
                      <p style="margin: 0 0 5px 0;"><strong>${item.productName || 'Product'}</strong></p>
                      <p style="margin: 0; color: #666; font-size: 14px;">Quantity: ${item.quantity} × ₱${item.price || item.productPrice}</p>
                    </div>
                  </div>
                `}).join('')}
              </div>
            ` : ''}
            
            <div style="background: #e3f2fd; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <h4 style="margin: 0 0 10px 0; color: #1976d2;">What's Next?</h4>
              <ul style="margin: 0; padding-left: 20px; color: #666;">
                <li>Your order is being prepared</li>
                <li>You'll receive updates on your order status</li>
                <li>Estimated delivery time: 2-3 business days</li>
              </ul>
            </div>
            
            <p style="color: #666; margin-top: 30px;">
              Thank you for shopping with ${process.env.STORE_NAME}! If you have any questions, please contact our support team.
            </p>
          </div>
          
          <div style="background: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
            <p style="margin: 0; color: #666; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
            <p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">
              © ${new Date().getFullYear()} ${process.env.STORE_NAME}. All rights reserved.
            </p>
          </div>
          <img 
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQrkPJSQhsjlfJZymbIcwLtj_F0ONvYfYfzAQ&s"
            alt="Product"
            width="60"
            height="60"
            style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:1px solid #ddd;"
          >
        </div>
      `
    };

    const result = await transporter.sendMail(emailContent);
    
    // If using Ethereal, show preview URL
    if (process.env.EMAIL_SERVICE === 'ethereal' && result.messageId) {
      console.log('Preview URL:', nodemailer.getTestMessageUrl(result));
    }

    console.log(`[${formatDate()}] - ✅ Payment confirmation email sent successfully to ${userEmail}`);
    return true;

  } catch (error) {
    logError(`❌ Failed to send payment confirmation email: ${error.message}`);
    return false;
  }
}

/**
 * Send order status update email
 */
async function sendOrderStatusUpdate(userEmail, userName, orderData, newStatus) {
  try {
    console.log(`[${formatDate()}] - 📧 Sending order status update email to ${userEmail}`);
    
    const transporter = createTransporter();
    if (!transporter) {
      console.log(`[${formatDate()}] - ⚠️  Email service not available - skipping order status email`);
      return false;
    }

    const statusColors = {
      'processing': '#4CAF50',
      'shipped': '#2196F3',
      'delivered': '#9C27B0',
      'cancelled': '#f44336'
    };

    const statusColor = statusColors[newStatus] || '#666';

    const emailContent = {
      from: `"${process.env.STORE_NAME}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `Order Update - ${orderData.orderNumber} is now ${newStatus}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${statusColor}; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Order Status Update</h1>
          </div>
          
          <div style="padding: 30px 20px;">
            <h2 style="color: #333;">Hi ${userName || 'Customer'},</h2>
            <p style="color: #666; line-height: 1.6;">
              Your order status has been updated. Here are the details:
            </p>
            
            <div style="background: #f8f9fa; border-left: 4px solid ${statusColor}; padding: 20px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #333;">Order Information</h3>
              <p style="margin: 5px 0;"><strong>Order Number:</strong> ${orderData.orderNumber}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold; text-transform: capitalize;">${newStatus}</span></p>
              <p style="margin: 5px 0;"><strong>Total Amount:</strong> ₱${orderData.totalAmount}</p>
            </div>
            
            <p style="color: #666; margin-top: 30px;">
              You can track your order status in your account dashboard or contact our support team if you have any questions.
            </p>
          </div>
          
          <div style="background: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
            <p style="margin: 0; color: #666; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
            <p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">
              © ${new Date().getFullYear()} ${process.env.STORE_NAME}. All rights reserved.
            </p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(emailContent);
    
    // If using Ethereal, show preview URL
    if (process.env.EMAIL_SERVICE === 'ethereal' && result.messageId) {
      console.log('Preview URL:', nodemailer.getTestMessageUrl(result));
    }

    console.log(`[${formatDate()}] - ✅ Order status update email sent successfully to ${userEmail}`);
    return true;

  } catch (error) {
    logError(`❌ Failed to send order status update email: ${error.message}`);
    return false;
  }
}

module.exports = {
  sendPaymentConfirmation,
  sendOrderStatusUpdate,
  createTransporter
};
