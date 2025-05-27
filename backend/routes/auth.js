const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../db'); // Import kết nối database từ db.js
const router = express.Router();

// Bỏ hoặc comment 2 dòng console.log này
// console.log('authRoutes:', authRoutes);
// console.log('typeof authRoutes:', typeof authRoutes);


// ĐĂNG KÝ
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  // 1. Kiểm tra đầu vào
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ tên người dùng, email và mật khẩu.' });
  }

  try {
    // 2. Kiểm tra xem người dùng hoặc email đã tồn tại chưa
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
      // Fallback (nên không xảy ra nếu logic trên đúng)
      return res.status(409).json({ message: 'Tên người dùng hoặc email đã tồn tại.' });
    }

    // 3. Hash mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10); // saltRounds = 10

    // 4. Lưu thông tin người dùng vào database
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
router.post('/login', async (req, res) => { // Thêm async
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Vui lòng cung cấp email và mật khẩu.' });
  }

  try {
    // Lấy password_hash để so sánh
    const [results] = await db.promise().query('SELECT id, email, password_hash FROM users WHERE email = ?', [email]);

    if (results.length === 0) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
    }

    const user = results[0];
    const valid = await bcrypt.compare(password, user.password_hash); // So sánh mật khẩu đã hash
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
router.post('/forgot-password', async (req, res) => { // Thêm async
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Vui lòng cung cấp email.' });
  }

  try {
    // Kiểm tra email có tồn tại không trước khi tạo token
    const [userCheck] = await db.promise().query('SELECT id FROM users WHERE email = ?', [email]);
    if (userCheck.length === 0) {
      // Trả về thông báo thành công chung chung để tránh leak thông tin email
      return res.status(200).json({ message: 'Nếu email tồn tại, email reset mật khẩu đã được gửi.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    // Sử dụng db.promise().query
    const [result] = await db.promise().query(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?',
      [token, expires, email]
    );

    // Không cần kiểm tra affectedRows ở đây vì đã kiểm tra email tồn tại ở trên
    // if (result.affectedRows === 0) { /* ... */ }

    // Cấu hình Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Sử dụng App Password cho tài khoản Gmail
      },
    });

    // const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`; // Sử dụng biến môi trường cho URL frontend
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`; // Dòng này là đúng để tạo ra URL

    await transporter.sendMail({ // Thêm await
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Reset mật khẩu của bạn',
      html: `<p>Bạn nhận được email này vì bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
             <p>Vui lòng nhấp vào liên kết sau hoặc dán nó vào trình duyệt của bạn để hoàn tất quá trình:</p>
             <p><a href="${resetUrl}">${resetUrl}</a></p>
             <p>Liên kết đặt lại mật khẩu này sẽ hết hạn sau 15 phút.</p>
             <p>Nếu bạn không yêu cầu điều này, vui lòng bỏ qua email này và mật khẩu của bạn sẽ vẫn không thay đổi.</p>`,
    });

    res.status(200).json({ message: 'Nếu email tồn tại, email reset mật khẩu đã được gửi.' }); // Thông báo chung chung

  } catch (error) {
    console.error('Lỗi khi gửi email reset mật khẩu:', error);
    res.status(500).json({ message: 'Đã xảy ra lỗi khi xử lý yêu cầu quên mật khẩu.' });
  }
});


// ROUTE ĐẶT LẠI MẬT KHẨU (CẦN FRONTEND GỬI TOKEN VÀ MẬT KHẨU MỚI)
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Vui lòng cung cấp token và mật khẩu mới.' });
  }

  try {
    // 1. Tìm người dùng với token hợp lệ và chưa hết hạn
    const [results] = await db.promise().query(
      'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [token]
    );

    if (results.length === 0) {
      return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
    }

    const userId = results[0].id;

    // 2. Hash mật khẩu mới
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 3. Cập nhật mật khẩu và xóa token reset
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


module.exports = router;