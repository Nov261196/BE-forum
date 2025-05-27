const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: process.env.DB_PORT || 3306,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

connection.connect(err => {
  if (err) {
    console.error('Kết nối MySQL thất bại:', err.message);
  } else {
    console.log('Kết nối MySQL thành công');
  }
});

module.exports = connection;
