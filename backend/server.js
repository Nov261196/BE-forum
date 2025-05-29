// backend/server.js

require('dotenv').config(); // Luôn đặt ở đầu tiên để tải biến môi trường

const express = require('express');
const cors = require('cors');
const path = require('path'); // Cần thiết cho path.join
const fs = require('fs');   // Cần thiết để kiểm tra và tạo thư mục
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000; // Sử dụng cổng từ .env hoặc 3000 mặc định

// ----------------------------------------------------
// BẮT LỖI TOÀN CẦU ĐỂ CHẨN ĐOÁN CRASH (Giữ lại để debugging)
// ----------------------------------------------------
process.on('uncaughtException', (err) => {
    console.error('Lỗi không được xử lý (Uncaught Exception):', err);
    // process.exit(1); // Tùy chọn: thoát ngay lập tức nếu muốn
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promise bị từ chối không được xử lý (Unhandled Rejection):', reason);
    // process.exit(1); // Tùy chọn: thoát ngay lập tức nếu muốn
});

// ----------------------------------------------------
// MIDDLEWARE CHÍNH
// ----------------------------------------------------
// Cấu hình CORS: QUAN TRỌNG ĐỂ FRONTEND CÓ THỂ GỌI API
// Đặt app.use(cors()) TRƯỚC các middleware và route khác
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'https://www.twentysix.click'
];

app.use(cors({
  origin: function (origin, callback) {
    // Cho phép request không có Origin (như Postman) hoặc từ các origin hợp lệ
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy does not allow this origin: ' + origin));
    }
  },
  credentials: true,
}));


// Để parse JSON body từ request
app.use(express.json());

// ----------------------------------------------------
// ĐẢM BẢO THƯ MỤC UPLOAD TỒN TẠI (KHẮC PHỤC LỖI STOPPING CONTAINER)
// ----------------------------------------------------
const uploadDir = path.join(__dirname, 'uploads');
const avatarDir = path.join(uploadDir, 'avatars');

if (!fs.existsSync(uploadDir)) {
    console.log(`Creating directory: ${uploadDir}`);
    fs.mkdirSync(uploadDir);
}
if (!fs.existsSync(avatarDir)) {
    console.log(`Creating directory: ${avatarDir}`);
    fs.mkdirSync(avatarDir);
}

// ----------------------------------------------------
// CẤU HÌNH ĐỂ PHỤC VỤ CÁC FILE STATIC
// ----------------------------------------------------
// Phục vụ các file frontend từ thư mục 'frontend'
// Ví dụ: truy cập /dashboard.html, /assets/css/dashboard.css
app.use(express.static(path.join(__dirname, '../frontend')));

// Phục vụ file tĩnh từ thư mục 'uploads' (cho avatar)
// Ví dụ: truy cập /uploads/avatars/ten_anh.jpg
app.use('/uploads', express.static(uploadDir)); // Sử dụng uploadDir đã tạo

// ----------------------------------------------------
// GẮN CÁC ROUTE API CỦA BẠN
// ----------------------------------------------------
// Sử dụng authRoutes cho các API routes (ví dụ: /api/profile, /api/upload-avatar)
app.use('/api', authRoutes);

// ----------------------------------------------------
// KHỞI ĐỘNG SERVER
// ----------------------------------------------------
app.listen(process.env.PORT, () => {
    console.log(` Server đang chạy tại http://localhost:${process.env.PORT}`);
});
