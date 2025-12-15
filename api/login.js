// File: api/login.js

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { email, password } = req.body;

  // Debugging: Check if env vars are loaded (remove this in production)
  // console.log("Server Env:", process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD); 

  const validEmail = process.env.ADMIN_EMAIL;
  const validPass = process.env.ADMIN_PASSWORD;

  if (!validEmail || !validPass) {
    return res.status(500).json({ message: 'Server Error: Admin credentials not set in ENV.' });
  }

  if (email === validEmail && password === validPass) {
    return res.status(200).json({ message: 'Login Success' });
  } else {
    return res.status(401).json({ message: 'Invalid Credentials' });
  }
}
