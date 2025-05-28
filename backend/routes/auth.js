const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('./db'); // Import kết nối database từ db.js
const router = express.Router();

// ----------------------------------------------------
// Middleware Xác thực - Đặt ở một file riêng (vd: backend/middleware/authMiddleware.js)
// và import vào đây để sử dụng.
// Hoặc, nếu muốn giữ ở đây, hãy định nghĩa nó TRƯỚC khi sử dụng.
// Tôi sẽ định nghĩa nó trực tiếp ở đây để tiện cho bạn sửa.
// ----------------------------------------------------
const protect = (req, res, next) => {
    let token;

    // Kiểm tra header Authorization có dạng "Bearer TOKEN"
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Lấy token từ header
            token = req.headers.authorization.split(' ')[1];

            // Xác minh token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Gắn thông tin người dùng (user ID) vào req để các route tiếp theo có thể sử dụng
            // Đảm bảo JWT_SECRET được định nghĩa trong biến môi trường Railway
            req.user = { id: decoded.id, email: decoded.email };

            next(); // Chuyển sang middleware hoặc route tiếp theo
        } catch (error) {
            console.error('Lỗi xác thực token:', error.message);
            // Nếu token không hợp lệ hoặc hết hạn
            return res.status(401).json({ message: 'Không được ủy quyền, token không hợp lệ hoặc đã hết hạn.' });
        }
    } else { // Nếu không có header Authorization hoặc không đúng định dạng
        return res.status(401).json({ message: 'Không được ủy quyền, không có token.' });
    }
};

// ----------------------------------------------------
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

// ----------------------------------------------------
// ĐĂNG NHẬP
router.post('/login', async (req, res) => {
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

// ----------------------------------------------------
// QUÊN MẬT KHẨU
router.post('/forgot-password', async (req, res) => {
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

        // Cấu hình Nodemailer
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS, // Sử dụng App Password cho tài khoản Gmail
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

// ----------------------------------------------------
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

// ----------------------------------------------------
// ROUTE LẤY THÔNG TIN NGƯỜI DÙNG HIỆN TẠI
// Sử dụng middleware 'protect' để bảo vệ route này
router.get('/profile', protect, async (req, res) => {
    try {
        // req.user.id được lấy từ middleware protect sau khi xác minh token
        // CHỈ LẤY CÁC TRƯỜNG THÔNG TIN CẦN THIẾT, KHÔNG LẤY password_hash!
        const [results] = await db.promise().query(
            'SELECT id, username, email FROM users WHERE id = ?',
            [req.user.id]
        );

        if (results.length === 0) {
            // Trường hợp này rất ít khi xảy ra nếu token hợp lệ và user ID đúng
            return res.status(404).json({ message: 'Người dùng không tìm thấy.' });
        }

        const user = results[0];
        res.status(200).json({
            id: user.id,
            username: user.username,
            email: user.email
            // Thêm các trường thông tin khác nếu có và cần thiết
        });

    } catch (error) {
        console.error('Lỗi khi lấy thông tin người dùng:', error);
        res.status(500).json({ message: 'Đã xảy ra lỗi khi tải thông tin người dùng.' });
    }
});

module.exports = router;