// Helper function to format date as mm/dd/yy-hh:mm:ss AM/PM
const formatDate = (date = new Date()) => {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  const formattedHours = String(hours).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  return `${month}/${day}/${year}-${formattedHours}:${minutes}:${seconds} ${ampm}`;
};

// Helper function for red error logging
const logError = (message) => {
  console.log(`\x1b[31m[${formatDate()}] - ${message}\x1b[0m`);
};

module.exports = { formatDate, logError };
