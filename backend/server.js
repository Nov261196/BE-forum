require('dotenv').config();
const express = require('express');
const cors = require('cors'); // Đảm bảo bạn đã `npm install cors`
const authRoutes = require('./routes/auth');
const app = express();
const PORT = process.env.PORT; // Sử dụng cổng 3000 từ .env hoặc 5000 mặc định
const path = require('path');

// Đảm bảo CORS được đặt TRƯỚC TẤT CẢ CÁC ROUTES và MIDDLEWARE khác cần nó
app.use(cors()); // Dòng này KHÔNG ĐƯỢC BỊ THIẾU HOẶC COMMENT!

app.use(express.json()); // Để parse JSON body từ request

// CẤU HÌNH ĐỂ PHỤC VỤ CÁC FILE STATIC CỦA FRONTEND
// Điều này cho phép bạn truy cập /dashboard.html, /profile.html, /assets/css/dashboard.css, v.v.
app.use(express.static(path.join(__dirname, '../frontend')));
// CẤU HÌNH ĐỂ PHỤC VỤ FILE TĨNH TỪ THƯ MỤC 'uploads'
// Điều này cho phép bạn truy cập /uploads/avatars/ten_anh.jpg
app.use('/uploads', express.static('uploads'));

// Sử dụng authRoutes cho các API routes (ví dụ: /api/profile, /api/upload-avatar)
app.use('/api', authRoutes);

app.listen(process.env.PORT, () => {
    console.log(` Server đang chạy tại http://localhost:${process.env.PORT}`);
});