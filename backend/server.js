require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path'); // Cần import path để xử lý đường dẫn file
const db = require('./db'); // Import kết nối database từ db.js

const authRoutes = require('./routes/auth'); // Đảm bảo đường dẫn này đúng
// Bỏ hoặc comment 2 dòng console.log này khi triển khai lên production
// console.log('typeof authRoutes:', typeof authRoutes);
// console.log('authRoutes:', authRoutes);

const app = express();
const PORT = process.env.PORT || 3000; // Sử dụng PORT từ .env hoặc mặc định 3000

// ----------------------------------------------------
// CẤU HÌNH CORS: QUAN TRỌNG ĐỂ FRONTEND CÓ THỂ GỌI API
// Đặt app.use(cors()) TRƯỚC các middleware và route khác
// ----------------------------------------------------
// Cấu hình CORS chi tiết hơn để cho phép credentials và chỉ định origin
const corsOptions = {
    origin: process.env.FRONTEND_URL, // Lấy URL frontend từ biến môi trường
    credentials: true, // Cho phép gửi cookies, headers ủy quyền, v.v.
    optionsSuccessStatus: 200 // Đối với các trình duyệt cũ
};
app.use(cors(corsOptions));

app.use(express.json()); // Middleware để parse JSON body từ request
app.use(express.urlencoded({ extended: true })); // Middleware để parse URL-encoded bodies (ví dụ: từ form)

// ----------------------------------------------------
// CẤU HÌNH ĐỂ PHỤC VỤ CÁC FILE STATIC CỦA FRONTEND
// Điều này biến thư mục 'frontend' (nằm cùng cấp với 'backend')
// thành thư mục gốc công khai của server Express.
// Ví dụ: truy cập /dashboard.html, /assets/css/main.css
// ----------------------------------------------------
app.use(express.static(path.join(__dirname, '../frontend')));

// ----------------------------------------------------
// CẤU HÌNH ĐỂ PHỤC VỤ FILE TĨNH TỪ THƯ MỤC 'uploads'
// Ví dụ: truy cập /uploads/avatars/ten_anh.jpg
// Đảm bảo thư mục 'uploads' nằm trong thư mục 'backend'
// ----------------------------------------------------
app.use('/uploads', express.static('uploads'));

// ----------------------------------------------------
// ĐỊNH NGHĨA CÁC ROUTE API
// Tất cả các route trong auth.js sẽ có tiền tố /api
// Ví dụ: POST /api/register, POST /api/login, GET /api/profile
// ----------------------------------------------------
app.use('/api', authRoutes);

// ----------------------------------------------------
// ROUTE FALLBACK CHO CÁC ĐƯỜNG DẪN FRONTEND (SPA)
// Điều này đảm bảo rằng nếu một đường dẫn không khớp với API nào
// hoặc file tĩnh nào, nó sẽ gửi lại index.html để frontend xử lý routing.
// Đặt nó SAU TẤT CẢ CÁC ROUTE VÀ STATIC FILE KHÁC.
// ----------------------------------------------------
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// ----------------------------------------------------
// KHỞI ĐỘNG SERVER
// ----------------------------------------------------
app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
