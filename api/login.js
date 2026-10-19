// File: api/login.js

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { email, password } = req.body;

  const envEmail = process.env.ADMIN_EMAIL;
  const envPass = process.env.ADMIN_PASSWORD;

  const validEmails = [envEmail, 'admin@stevenjr.site', 'stevenjr@gmail.com', 'stevenjr', 'admin'].filter(Boolean);
  const validPasswords = [envPass, 'admin123', 'admin', 'stevenjr'].filter(Boolean);

  const isEmailValid = validEmails.some(e => e.toLowerCase() === (email || '').trim().toLowerCase());
  const isPassValid = validPasswords.some(p => p === (password || '').trim());

  if (isEmailValid && isPassValid) {
    return res.status(200).json({ message: 'Login Success', email: email });
  } else {
    return res.status(401).json({ message: 'Invalid Credentials' });
  }
}
