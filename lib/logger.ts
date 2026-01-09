export const logError = async (message: string, details?: any) => {
  // Always log to browser console
  console.error(message, details);

  // Send to server for Vercel logging
  try {
    await fetch('/api/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        level: 'error',
        message,
        details,
      }),
    });
  } catch (err) {
    // Prevent infinite loops if logging fails
    console.error('Failed to send log to server:', err);
  }
};

export const logInfo = async (message: string, details?: any) => {
  console.log(message, details);
  
  try {
    await fetch('/api/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        level: 'info',
        message,
        details,
      }),
    });
  } catch (err) {
    console.error('Failed to send log to server:', err);
  }
};
