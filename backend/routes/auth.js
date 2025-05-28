const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const router = express.Router();
require('dotenv').config();

// ----------------------------------------------------
// MIDDLEWARE XÁC THỰC TOKEN JWT (ĐỊNH NGHĨA MỘT LẦN)
// ----------------------------------------------------
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
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

// ----------------------------------------------------
// CẤU HÌNH MULTER CHO UPLOAD AVATAR (ĐỊNH NGHĨA MỘT LẦN)
// ----------------------------------------------------
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Đảm bảo thư mục 'uploads/avatars' tồn tại trong thư mục gốc của server
        // Bạn cần tạo thư mục này thủ công nếu nó chưa có.
        cb(null, 'uploads/avatars/');
    },
    filename: (req, file, cb) => {
        // Tạo tên file duy nhất để tránh trùng lặp
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận file ảnh!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 1024 * 1024 * 5 // Giới hạn 5MB
    }
});

// ----------------------------------------------------
// CÁC ROUTE API (ĐỊNH NGHĨA MỘT LẦN)
// ----------------------------------------------------

// ĐĂNG KÝ
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ tên người dùng, email và mật khẩu.' });
  }

  try {
    const [existingUsers] = await db.promise().query(
      'SELECT username, email FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      const isUsernameTaken = existingUsers.some(user => user.username === username);
      const isEmailTaken = existingUsers.some(user => user.email === email);

      if (isUsernameTaken) {
        return res.status(409).json({ message: 'Tên người dùng đã tồn tại.' });
      }
      if (isEmailTaken) {
        return res.status(409).json({ message: 'Email đã tồn tại.' });
      }
      return res.status(409).json({ message: 'Tên người dùng hoặc email đã tồn tại.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.promise().query(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    res.status(201).json({ message: 'Đăng ký thành công', userId: result.insertId });

  } catch (error) {
    console.error('Lỗi khi đăng ký người dùng:', error);
    res.status(500).json({ message: 'Đã xảy ra lỗi khi đăng ký tài khoản.' });
  }
});

// ĐĂNG NHẬP
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Vui lòng cung cấp email và mật khẩu.' });
  }

  try {
    const [results] = await db.promise().query('SELECT id, email, password_hash FROM users WHERE email = ?', [email]);

    if (results.length === 0) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
    }

    const user = results[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Đăng nhập thành công', token });

  } catch (error) {
    console.error('Lỗi khi đăng nhập:', error);
    res.status(500).json({ message: 'Đã xảy ra lỗi khi đăng nhập.' });
  }
});

// QUÊN MẬT KHẨU
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Vui lòng cung cấp email.' });
  }

  try {
    const [userCheck] = await db.promise().query('SELECT id FROM users WHERE email = ?', [email]);
    if (userCheck.length === 0) {
      return res.status(200).json({ message: 'Đã gửi về email của bạn, vui lòng kiểm tra email reset mật khẩu.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    const [result] = await db.promise().query(
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
      subject: 'Reset mật khẩu của bạn',
      html: `<p>Bạn nhận được email này vì bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
             <p>Vui lòng nhấp vào liên kết sau hoặc dán nó vào trình duyệt của bạn để hoàn tất quá trình:</p>
             <p><a href="${resetUrl}">${resetUrl}</a></p>
             <p>Liên kết đặt lại mật khẩu này sẽ hết hạn sau 15 phút.</p>
             <p>Nếu bạn không yêu cầu điều này, vui lòng bỏ qua email này và mật khẩu của bạn sẽ vẫn không thay đổi.</p>`,
    });

    res.status(200).json({ message: 'Nếu email tồn tại, email reset mật khẩu đã được gửi.' });

  } catch (error) {
    console.error('Lỗi khi gửi email reset mật khẩu:', error);
    res.status(500).json({ message: 'Đã xảy ra lỗi khi xử lý yêu cầu quên mật khẩu.' });
  }
});

// ĐẶT LẠI MẬT KHẨU
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Vui lòng cung cấp token và mật khẩu mới.' });
  }

  try {
    const [results] = await db.promise().query(
      'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [token]
    );

    if (results.length === 0) {
      return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
    }

    const userId = results[0].id;
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.promise().query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [hashedPassword, userId]
    );

    res.status(200).json({ message: 'Mật khẩu đã được đặt lại thành công!' });

  } catch (error) {
    console.error('Lỗi khi đặt lại mật khẩu:', error);
    res.status(500).json({ message: 'Đã xảy ra lỗi khi đặt lại mật khẩu.' });
  }
});

// LẤY THÔNG TIN NGƯỜI DÙNG (Yêu cầu đăng nhập)
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const [results] = await db.promise().query(
            'SELECT id, username, email, created_at, avatar_url FROM users WHERE id = ?',
            [req.user.id]
        );

        if (results.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }

        const userProfile = results[0];
        delete userProfile.password_hash; // Không bao giờ gửi password_hash ra ngoài

        res.status(200).json(userProfile);
    } catch (error) {
        console.error('Lỗi khi lấy thông tin hồ sơ:', error);
        res.status(500).json({ message: 'Đã xảy ra lỗi khi lấy thông tin hồ sơ.' });
    }
});

// UPLOAD AVATAR
router.post('/upload-avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Không có file ảnh được tải lên.' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    try {
        await db.promise().query(
            'UPDATE users SET avatar_url = ? WHERE id = ?',
            [avatarUrl, req.user.id]
        );
        res.status(200).json({ message: 'Ảnh đại diện đã được cập nhật thành công.', avatar_url: avatarUrl });
    } catch (error) {
        console.error('Lỗi khi cập nhật avatar_url vào database:', error);
        res.status(500).json({ message: 'Đã xảy ra lỗi khi cập nhật ảnh đại diện.' });
    }
});



module.exports = router;
