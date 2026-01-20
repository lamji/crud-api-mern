const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const { createTransporter } = require('../helpers/emailService');

const router = express.Router();

function getResumeHtml() {
  // Keep this HTML as the single source of truth for the PDF.
  // If you want to sync it from your Next app, you can paste the same template here.
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Jick T. Lampago - Resume</title>
        <style>
          @page { margin: 1cm; }
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #1e293b;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
            display: flex;
            gap: 20px;
          }
          .left-column {
            flex: 2;
            padding-right: 20px;
            border-right: 2px solid #e5e7eb;
          }
          .right-column {
            flex: 1;
            padding-left: 20px;
          }
          .header {
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 2px solid #3b82f6;
          }
          .name {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 4px;
            color: #1e40af;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .title {
            font-size: 12px;
            color: #4b5563;
            margin-bottom: 12px;
          }
          .contact { font-size: 9px; }
          .contact-item { margin: 2px 0; }
          .section { margin-bottom: 16px; }
          .section-title {
            font-size: 14px;
            font-weight: bold;
            color: #1e40af;
            margin: 16px 0 8px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 4px;
          }
          .summary { font-size: 9px; color: #334155; line-height: 1.5; }
          .job { margin-bottom: 16px; }
          .job-header { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .job-title { font-weight: bold; font-size: 11px; }
          .company { color: #4b5563; font-weight: bold; font-size: 10px; }
          .period { color: #6b7280; font-style: italic; font-size: 9px; }
          .job-description { font-size: 9px; margin: 6px 0 8px; line-height: 1.4; }
          .skills-container { display: flex; flex-wrap: wrap; gap: 3px; }
          .skill-tag {
            background: #e0f2fe;
            color: #0369a1;
            padding: 1px 6px;
            border-radius: 10px;
            font-size: 8px;
            display: inline-block;
          }
          .divider { height: 1px; background-color: #e5e7eb; margin: 12px 0; }
          .education-item { margin-bottom: 12px; }
          .reference-item { margin-bottom: 8px; }
          @media print {
            a { text-decoration: none; color: inherit; }
            .no-print { display: none; }
            body { padding: 10px; font-size: smaller; }
          }
        </style>
      </head>
      <body>
        <div class="left-column">
          <div class="header">
            <div class="name">JICK T. LAMPAGO</div>
            <div class="title">Frontend Developer</div>
            <div class="contact">
              <div class="contact-item">📧 lampagojick5@gmail.com</div>
              <div class="contact-item">📱 09490390624</div>
              <div class="contact-item">📍 Sitio Crossan, Talisay, Cebu, Philippines</div>
              <a href="https://www.linkedin.com/in/jick-lampago" class="contact-item">🌐 https://www.linkedin.com/in/jick-lampago</a>
              <a href="https://www.jicklampago.xyz" class="contact-item">🌐 https://www.jicklampago.xyz</a>
            </div>
          </div>

          <div class="section">
            <div class="section-title">PROFESSIONAL SUMMARY</div>
            <div class="summary">
              Results-driven Frontend Developer with 4+ years of experience in building responsive and 
              user-friendly web applications. Proficient in React, Next.js, and modern JavaScript 
              frameworks. Passionate about creating efficient, accessible, and visually appealing 
              interfaces. Strong collaborator with experience in Agile environments and a track record 
              of delivering high-quality code.
            </div>
          </div>

          <div class="divider"></div>

          <div class="section">
            <div class="section-title">WORK EXPERIENCE</div>

            <div class="job">
              <div class="job-header">
                <span class="job-title">Mid Frontend Developer</span>
                <span class="period">2022 - Present</span>
              </div>
              <div class="company">Commerce Acceptance Solution. Inc</div>
              <div class="job-description">
                • Develop and maintain secure, high-traffic web applications focused on payment processing, e-commerce workflows, and admin portals.<br>
                • Contribute to the frontend of payment gateway–related systems, ensuring secure handling of sensitive data and compliance with best practices.<br>
                • Led the modernization of a legacy JavaScript codebase to React + TypeScript, significantly improving code reliability, maintainability, and reducing production issues by ~40%.<br>
                • Build role-based admin dashboards for transaction monitoring, order management, and system configuration.<br>
                • Implement scalable state management and data fetching using Redux and React Query, ensuring consistent and predictable UI behavior.<br>
                • Collaborate closely with backend, QA, and product teams to deliver secure, performance-optimized user experiences.<br>
                • Apply accessibility standards and responsive design principles for cross-device and cross-browser compatibility.
              </div>
            </div>

            <div class="job">
              <div class="job-header">
                <span class="job-title">Frontend Developer</span>
                <span class="period">Jun 2022 - Aug 2022</span>
              </div>
              <div class="company">Elearnified</div>
              <div class="job-description">
                • Revamped the Moodle-based LMS for Philippine Red Cross, improving user experience 
                  and accessibility.<br>
                • Implemented responsive designs using SCSS and enhanced interactivity with JavaScript 
                  and jQuery.<br>
                • Collaborated with the design team to implement UI/UX improvements.
              </div>
            </div>

            <div class="job">
              <div class="job-header">
                <span class="job-title">React.js Developer</span>
                <span class="period">Nov 2020 - Dec 2020</span>
              </div>
              <div class="company">Codally Tech</div>
              <div class="job-description">
                • Part of the UI development team working on A+ Learning platform, an online school platform during pandemic<br>
                • Developed the entire UI using Next.js and Material UI following Agile methodology<br>
                • Collaborated with team members to implement responsive and user-friendly designs<br>
                • Contributed to the development of educational features for the online learning platform
              </div>
            </div>

            <div class="job">
              <div class="job-header">
                <span class="job-title">Full Stack Developer</span>
                <span class="period">Mar 2021 - May 2022</span>
              </div>
              <div class="company">Abakada Studios</div>
              <div class="job-description">
                • Developed and maintained frontend applications using Vue.js and vanilla JavaScript.<br>
                • Integrated Paymongo payment gateway into multiple e-commerce platforms.<br>
                • Collaborated with backend developers to design and implement RESTful APIs.
              </div>
            </div>
          </div>
        </div>

        <div class="right-column">
          <div class="section">
            <div class="section-title">TECHNICAL SKILLS</div>

            <div style="font-size: 10px; font-weight: bold; margin: 4px 0; color: #1e293b;">Frontend Development</div>
            <div class="skills-container">
              ${[
                'React',
                'Next.js',
                'TypeScript',
                'Tailwind CSS',
                'Redux',
                'React Query',
                'Shadcn/ui',
                'Material UI',
              ].map((skill) => `<span class="skill-tag">${skill}</span>`).join('')}
            </div>

            <div style="font-size: 10px; font-weight: bold; margin: 8px 0 4px; color: #1e293b;">Mobile Development</div>
            <div class="skills-container">
              ${['React Native', 'Expo', 'iOS', 'Android', 'Mobile UI/UX', 'Native Modules']
                .map((skill) => `<span class="skill-tag">${skill}</span>`)
                .join('')}
            </div>

            <div style="font-size: 10px; font-weight: bold; margin: 8px 0 4px; color: #1e293b;">Backend Development</div>
            <div class="skills-container">
              ${['Node.js', 'Express', 'REST APIs', 'MongoDB']
                .map((skill) => `<span class="skill-tag">${skill}</span>`)
                .join('')}
            </div>

            <div style="font-size: 10px; font-weight: bold; margin: 8px 0 4px; color: #1e293b;">DevOps & AI Tools</div>
            <div class="skills-container">
              ${['Git', 'CI/CD', 'ChatGPT', 'GitHub Copilot', 'Windsurf']
                .map((skill) => `<span class="skill-tag">${skill}</span>`)
                .join('')}
            </div>
          </div>

          <div class="divider"></div>

          <div class="section">
            <div class="section-title">EDUCATION</div>

            <div class="education-item">
              <div style="font-weight: bold; font-size: 10px;">Apprenticeship in Full Stack Web Developer</div>
              <div class="company" style="font-size: 9px;">Tuitt Bootcamp Ph</div>
              <div class="period" style="font-size: 8px;">June 2020 - October 2020</div>
            </div>

            <div class="education-item">
              <div style="font-weight: bold; font-size: 10px;">Associated Course in Information Technology</div>
              <div class="company" style="font-size: 9px;">Cataingan Polytechnic Institute</div>
              <div class="period" style="font-size: 8px;">March 2011 - June 2013</div>
            </div>
          </div>

          <div class="divider"></div>

          <div class="section">
            <div class="section-title">CHARACTER REFERENCE</div>

            <div class="reference-item">
              <div style="font-weight: bold; font-size: 10px;">John Jason Gesulgon</div>
              <div class="company" style="font-size: 9px;">Development Manager</div>
              <div style="margin-top: 2px;">
                <div style="font-size: 8px; color: #6b7280;">📧 jjgesulgon@gmail.com</div>
                <div style="font-size: 8px; color: #6b7280;">📱 09258696132</div>
              </div>
            </div>

            <div class="reference-item">
              <div style="font-weight: bold; font-size: 10px;">Emmanuel Ganzon</div>
              <div class="company" style="font-size: 9px;">Personal Friend</div>
              <div style="margin-top: 2px;">
                <div style="font-size: 8px; color: #6b7280;">📧 emmanuel.ganzon93@gmail.com</div>
                <div style="font-size: 8px; color: #6b7280;">📱 09569144288</div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function generateResumePdfBuffer() {
  console.log('Platform:', process.platform);
  console.log('Node version:', process.version);
  
  const isServerless = !!process.env.AWS_REGION || process.env.VERCEL === '1' || !!process.env.VERCEL_REGION;

  let browser;
  if (isServerless) {
    const executablePath = await chromium.executablePath();
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });
  } else {
    // For local development and containers
    const executablePath = 
      process.platform === 'win32' 
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : '/usr/bin/google-chrome'; // Try this first
    
    console.log('Trying Chrome at:', executablePath);
    
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
    } catch (chromeError) {
      console.log('Chrome not found at default path, trying alternatives...');
      
      // Try common Linux Chrome locations
      const alternatives = [
        '/home/heroku/.cache/puppeteer/chrome/linux-143.0.7499.192/chrome-linux64/chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/local/bin/chrome',
        '/snap/bin/chromium',
        '/usr/bin/google-chrome'
      ];
      
      for (const altPath of alternatives) {
        try {
          console.log('Trying:', altPath);
          browser = await puppeteer.launch({
            headless: true,
            executablePath: altPath,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
          });
          console.log('Success with:', altPath);
          break;
        } catch (e) {
          console.log('Failed:', altPath);
        }
      }
      
      if (!browser) {
        throw new Error('Chrome/Chromium not found. Please install Chrome or use pre-generated PDF.');
      }
    }
  }

  try {
    const page = await browser.newPage();
    await page.setContent(getResumeHtml(), { waitUntil: 'networkidle0' });

    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1cm',
        bottom: '1cm',
        left: '1cm',
        right: '1cm',
      },
    });

    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}

router.post('/send', async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email || typeof email !== 'string' || !email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    const transporter = createTransporter();
    if (!transporter) {
      return res.status(500).json({ success: false, message: 'Email service not configured on server' });
    }

    let pdfBuffer = null;
    try {
      pdfBuffer = await generateResumePdfBuffer();
      console.log('PDF generated successfully');
    } catch (pdfError) {
      console.error('PDF generation failed, sending link instead:', pdfError);
      // Fallback: just send the resume link
    }

    const emailContent = {
      from: `"Jick T. Lampago" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Resume - Jick T. Lampago',
      html: pdfBuffer 
        ? `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <p>Hello,</p>
            <p>Thank you for your interest in my profile. I've attached my resume for your review.</p>
            <p>Best regards,<br>Jick T. Lampago</p>
           </div>`
        : `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <p>Hello,</p>
            <p>Thank you for your interest in my resume!</p>
            <p>You can view my complete profile and portfolio at: <a href="https://www.jicklampago.xyz">www.jicklampago.xyz</a></p>
            <p>Best regards,<br>Jick T. Lampago</p>
           </div>`,
      attachments: pdfBuffer ? [{
        filename: 'Jick_Lampago_Resume.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf',
      }] : undefined,
    };

    await transporter.sendMail(emailContent);

    return res.json({ 
      success: true, 
      message: pdfBuffer ? 'Resume sent successfully!' : 'Resume link sent successfully!' 
    });
  } catch (error) {
    console.error('resume/send error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send resume' });
  }
});

module.exports = router;
