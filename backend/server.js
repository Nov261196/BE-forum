require('dotenv').config();
const express = require('express');
const cors = require('cors'); // Đảm bảo bạn đã `npm install cors`
const authRoutes = require('./routes/auth');
const app = express();
const PORT = process.env.PORT; // Sử dụng cổng 3000 từ .env hoặc 5000 mặc định
const jwt = require('jsonwebtoken'); // Đảm bảo đã cài đặt jwt nếu chưa có
const crypto = require('crypto'); // Đảm bảo đã cài đặt crypto nếu chưa có
const fs = require('fs'); // Thêm dòng này nếu chưa có
const path = require('path'); // Đảm bảo đã có dòng này

// Đảm bảo thư mục 'uploads' và 'uploads/avatars' tồn tại
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

// CẤU HÌNH ĐỂ PHỤC VỤ CÁC FILE STATIC CỦA FRONTEND
app.use(express.static(path.join(__dirname, '../frontend')));
// CẤU HÌNH ĐỂ PHỤC VỤ FILE TĨNH TỪ THƯ MỤC 'uploads'
app.use('/uploads', express.static('uploads')); // Dòng này giờ sẽ tìm thấy thư mục đã tạo

// Sử dụng authRoutes cho các API routes
app.use('/api', authRoutes);

app.listen(process.env.PORT, () => {
    console.log(` Server đang chạy tại http://localhost:${process.env.PORT}`);
});