const mysql = require('mysql2');
require('dotenv').config(); // Đảm bảo dotenv được tải nếu bạn chạy cục bộ

const connection = mysql.createConnection({
  // Sử dụng biến môi trường chuẩn của Railway
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  port: process.env.MYSQL_PORT, // Railway sẽ cung cấp port này, không cần || 11697 ở đây nữa
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

connection.connect(err => {
  if (err) {
    console.error('Kết nối MySQL thất bại:', err.message);
  } else {
    console.log('Kết nối MySQL thành công');
  }
});

module.exports = connection;