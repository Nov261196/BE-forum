// ==============================
// ===== IMPORT & CẤU HÌNH =====
// ==============================
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const multer = require('multer');
const cors = require('cors');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const db = require('../db');
require('dotenv').config();

const router = express.Router();

// ==============================
// ===== CORS BẢO MẬT =====
// ==============================
router.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

// ==============================
// ===== CẤU HÌNH CLOUDINARY =====
// ==============================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'avatars',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 300, height: 300, crop: 'limit' }],
  },
});
const upload = multer({ storage });

// ==============================
// ===== MIDDLEWARE XÁC THỰC TOKEN =====
// ==============================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Không có token truy cập.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('Lỗi xác thực token:', err);
      return res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
    }
    req.user = user;
    next();
  });
}

// ==============================
// ===== ĐĂNG KÝ / ĐĂNG NHẬP =====
// ==============================

// Đăng ký
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin.' });
  }

  try {
    const [existing] = await db.promise().query(
      'SELECT username, email FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    const taken = existing.reduce((acc, u) => {
      if (u.username === username) acc.username = true;
      if (u.email === email) acc.email = true;
      return acc;
    }, { username: false, email: false });

    if (taken.username || taken.email) {
      return res.status(409).json({
        message: taken.username
          ? 'Tên người dùng đã tồn tại.'
          : 'Email đã tồn tại.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.promise().query(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    res.status(201).json({ message: 'Đăng ký thành công', userId: result.insertId });
  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    res.status(500).json({ message: 'Lỗi khi đăng ký tài khoản.' });
  }
});

// Đăng nhập
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Vui lòng cung cấp email và mật khẩu.' });

  try {
    const [users] = await db.promise().query(
      'SELECT id, email, password_hash FROM users WHERE email = ?',
      [email]
    );
    if (users.length === 0) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ message: 'Đăng nhập thành công', token });
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    res.status(500).json({ message: 'Lỗi khi đăng nhập.' });
  }
});

// ==============================
// ===== QUÊN / ĐẶT LẠI MẬT KHẨU =====
// ==============================

// Quên mật khẩu - Gửi email
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Vui lòng cung cấp email.' });

  try {
    const [users] = await db.promise().query('SELECT id FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(200).json({ message: 'Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    await db.promise().query(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?',
      [token, expires, email]
    );

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Đặt lại mật khẩu',
      html: `
        <p>Bạn đã yêu cầu đặt lại mật khẩu.</p>
        <p>Nhấn vào liên kết sau để đặt lại:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>Liên kết sẽ hết hạn sau 15 phút.</p>
      `,
    });

    res.json({ message: 'Nếu email tồn tại, email đặt lại mật khẩu đã được gửi.' });
  } catch (error) {
    console.error('Lỗi quên mật khẩu:', error);
    res.status(500).json({ message: 'Lỗi khi gửi email reset mật khẩu.' });
  }
});

// Đặt lại mật khẩu
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Vui lòng cung cấp token và mật khẩu mới.' });
  }

  try {
    const [users] = await db.promise().query(
      'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [token]
    );
    if (users.length === 0) {
      return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.promise().query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [hashedPassword, users[0].id]
    );

    res.json({ message: 'Mật khẩu đã được đặt lại thành công.' });
  } catch (error) {
    console.error('Lỗi đặt lại mật khẩu:', error);
    res.status(500).json({ message: 'Lỗi khi đặt lại mật khẩu.' });
  }
});

// ==============================
// ===== THÔNG TIN HỒ SƠ =====
// ==============================

// Lấy hồ sơ người dùng
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const [users] = await db.promise().query(
      'SELECT id, username, email, created_at, avatar_url FROM users WHERE id = ?',
      [req.user.id]
    );
    if (users.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    res.json(users[0]);
  } catch (error) {
    console.error('Lỗi lấy hồ sơ:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy hồ sơ.' });
  }
});

// Cập nhật hồ sơ
router.post('/update-profile', authenticateToken, async (req, res) => {
  const { username, email } = req.body;
  if (!username || !email) return res.status(400).json({ message: 'Thiếu thông tin.' });

  try {
    await db.promise().query(
      'UPDATE users SET username = ?, email = ? WHERE id = ?',
      [username, email, req.user.id]
    );
    res.json({ message: 'Cập nhật thông tin thành công.' });
  } catch (error) {
    console.error('Lỗi cập nhật hồ sơ:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật thông tin.' });
  }
});

// Đổi mật khẩu
router.post('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Thiếu thông tin mật khẩu.' });
  }

  try {
    const [users] = await db.promise().query(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );
    const match = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!match) {
      return res.status(403).json({ message: 'Mật khẩu hiện tại không đúng.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.promise().query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newHash, req.user.id]
    );

    res.json({ message: 'Đổi mật khẩu thành công.' });
  } catch (error) {
    console.error('Lỗi đổi mật khẩu:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi đổi mật khẩu.' });
  }
});

// ==============================
// ===== CẬP NHẬT AVATAR =====
// ==============================

// Tải ảnh đại diện mới
router.post('/upload-avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  if (!req.file?.path) {
    return res.status(400).json({ message: 'Không có file ảnh được tải lên.' });
  }

  try {
    const avatarUrl = req.file.path;
    await db.promise().query(
      'UPDATE users SET avatar_url = ? WHERE id = ?',
      [avatarUrl, req.user.id]
    );
    res.json({ message: 'Cập nhật ảnh đại diện thành công.', avatar_url: avatarUrl });
  } catch (error) {
    console.error('Lỗi cập nhật avatar:', error);
    res.status(500).json({ message: 'Lỗi khi lưu avatar.' });
  }
});

// ==============================
// ===== EXPORT ROUTER =====
// ==============================
module.exports = router;
