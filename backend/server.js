// // backend/server.js

// require('dotenv').config(); // Luôn đặt ở đầu tiên để tải biến môi trường

// const express = require('express');
// const cors = require('cors');
// const path = require('path'); // Cần thiết cho path.join
// const fs = require('fs');   // Cần thiết để kiểm tra và tạo thư mục
// const authRoutes = require('./routes/auth');

// const app = express();
// const PORT = process.env.PORT || 3000; // Sử dụng cổng từ .env hoặc 3000 mặc định

// // ----------------------------------------------------
// // BẮT LỖI TOÀN CẦU ĐỂ CHẨN ĐOÁN CRASH (Giữ lại để debugging)
// // ----------------------------------------------------
// process.on('uncaughtException', (err) => {
//     console.error('Lỗi không được xử lý (Uncaught Exception):', err);
//     // process.exit(1); // Tùy chọn: thoát ngay lập tức nếu muốn
// });

// process.on('unhandledRejection', (reason, promise) => {
//     console.error('Promise bị từ chối không được xử lý (Unhandled Rejection):', reason);
//     // process.exit(1); // Tùy chọn: thoát ngay lập tức nếu muốn
// });

// // ----------------------------------------------------
// // MIDDLEWARE CHÍNH
// // ----------------------------------------------------
// // Cấu hình CORS: QUAN TRỌNG ĐỂ FRONTEND CÓ THỂ GỌI API
// // Đặt app.use(cors()) TRƯỚC các middleware và route khác
// const allowedOrigins = [
//   'http://localhost:3000',
//   'http://127.0.0.1:5500',
//   'https://www.twentysix.click'
// ];

// app.use(cors({
//   origin: function (origin, callback) {
//     // Cho phép request không có Origin (như Postman) hoặc từ các origin hợp lệ
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error('CORS policy does not allow this origin: ' + origin));
//     }
//   },
//   credentials: true,
// }));


// // Để parse JSON body từ request
// app.use(express.json());

// // ----------------------------------------------------
// // ĐẢM BẢO THƯ MỤC UPLOAD TỒN TẠI (KHẮC PHỤC LỖI STOPPING CONTAINER)
// // ----------------------------------------------------
// const uploadDir = path.join(__dirname, 'uploads');
// const avatarDir = path.join(uploadDir, 'avatars');

// if (!fs.existsSync(uploadDir)) {
//     console.log(`Creating directory: ${uploadDir}`);
//     fs.mkdirSync(uploadDir);
// }
// if (!fs.existsSync(avatarDir)) {
//     console.log(`Creating directory: ${avatarDir}`);
//     fs.mkdirSync(avatarDir);
// }

// // ----------------------------------------------------
// // CẤU HÌNH ĐỂ PHỤC VỤ CÁC FILE STATIC
// // ----------------------------------------------------
// // Phục vụ các file frontend từ thư mục 'frontend'
// // Ví dụ: truy cập /dashboard.html, /assets/css/dashboard.css
// app.use(express.static(path.join(__dirname, '../frontend')));

// // Phục vụ file tĩnh từ thư mục 'uploads' (cho avatar)
// // Ví dụ: truy cập /uploads/avatars/ten_anh.jpg
// app.use('/uploads', express.static(uploadDir)); // Sử dụng uploadDir đã tạo

// // ----------------------------------------------------
// // GẮN CÁC ROUTE API CỦA BẠN
// // ----------------------------------------------------
// // Sử dụng authRoutes cho các API routes (ví dụ: /api/profile, /api/upload-avatar)
// app.use('/api', authRoutes);

// // ----------------------------------------------------
// // KHỞI ĐỘNG SERVER
// // ----------------------------------------------------
// app.listen(process.env.PORT, () => {
//     console.log(` Server đang chạy tại http://localhost:${process.env.PORT}`);
// });


// backend/server.js

console.log('1. Starting server.js execution...');
require('dotenv').config(); // Luôn đặt ở đầu tiên để tải biến môi trường
console.log('2. .env loaded.');

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const authRoutes = require('./routes/auth'); // Import authRoutes
console.log('3. All core modules imported (express, cors, path, fs, authRoutes).');

const app = express();
const PORT = process.env.PORT || 3000;
console.log(`4. Express app initialized. PORT: ${PORT}`);

// ----------------------------------------------------
// BẮT LỖI TOÀN CẦU ĐỂ CHẨN ĐOÁN CRASH
// ----------------------------------------------------
process.on('uncaughtException', (err) => {
    console.error('CRITICAL ERROR: Uncaught Exception - App is crashing!', err);
    // process.exit(1); 
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL ERROR: Unhandled Rejection - App is crashing!', reason);
    // process.exit(1); 
});
console.log('5. Global error handlers set up.');

// ----------------------------------------------------
// MIDDLEWARE CHÍNH
// ----------------------------------------------------
console.log('6. Setting up CORS middleware...');
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'https://www.twentysix.click' // Đảm bảo đây là URL chính xác của frontend của bạn
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS policy does not allow this origin: ' + origin));
        }
    },
    credentials: true,
}));
console.log('7. CORS middleware configured.');

console.log('8. Setting up JSON body parser middleware...');
app.use(express.json()); // Để parse JSON body từ request
console.log('9. JSON body parser configured.');

// ----------------------------------------------------
// ĐẢM BẢO THƯ MỤC UPLOAD TỒN TẠI
// ----------------------------------------------------
console.log('10. Checking/creating upload directories...');
const uploadDir = path.join(__dirname, 'uploads');
const avatarDir = path.join(uploadDir, 'avatars');

if (!fs.existsSync(uploadDir)) {
    console.log(`10a. Creating directory: ${uploadDir}`);
    fs.mkdirSync(uploadDir);
}
if (!fs.existsSync(avatarDir)) {
    console.log(`10b. Creating directory: ${avatarDir}`);
    fs.mkdirSync(avatarDir);
}
console.log('11. Upload directories checked/created.');

// ----------------------------------------------------
// CẤU HÌNH ĐỂ PHỤC VỤ CÁC FILE STATIC
// ----------------------------------------------------
console.log('12. Setting up static file serving for frontend...');
app.use(express.static(path.join(__dirname, '../frontend')));
console.log('13. Static serving for frontend configured.');

console.log('14. Setting up static file serving for uploads...');
app.use('/uploads', express.static(uploadDir)); // Sử dụng uploadDir đã tạo
console.log('15. Static serving for uploads configured.');

// ----------------------------------------------------
// GẮN CÁC ROUTE API CỦA BẠN
// ----------------------------------------------------
console.log('16. Attaching authRoutes to /api...');
app.use('/api', authRoutes);
console.log('17. authRoutes attached.');

// ----------------------------------------------------
// KHỞI ĐỘNG SERVER
// ----------------------------------------------------
console.log('18. Attempting to start server listener...');
app.listen(PORT, () => {
    console.log(`19. Server is running at http://localhost:${PORT}`);
    // console.log('20. MySQL connection established.'); // This log is from db.js, not server.js
});
console.log('21. app.listen call completed.');