require('dotenv').config();
const express = require('express');
const cors = require('cors'); // Sửa lỗi chính tả trong comment: 'cors'
const authRoutes = require('./routes/auth');
console.log('typeof authRoutes:', typeof authRoutes);
console.log('authRoutes:', authRoutes);

const app = express();

// ----------------------------------------------------
// CẤU HÌNH CORS: QUAN TRỌNG ĐỂ FRONTEND CÓ THỂ GỌI API
// Đặt app.use(cors()) TRƯỚC các middleware và route khác
// ----------------------------------------------------
app.use(cors()); // Dòng này bị thiếu trong code bạn gửi!

app.use(express.json()); // Để parse JSON body từ request
app.use('/api', authRoutes); // Sử dụng authRoutes như một middleware

app.listen(process.env.PORT, () => {
  console.log(` Server đang chạy tại http://localhost:${process.env.PORT}`);
});