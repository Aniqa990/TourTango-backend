const express = require('express');
const mysql = require('mysql');
const app = express();
const port = 3000;

// MySQL connection
const connection = mysql.createConnection({
host: 'localhost',
user: 'root',
password: '',
database: 'tourtango'
});

connection.connect((err) => {
if (err) throw err;
console.log('Connected to MySQL database!');
});

app.use(express.json());

// Define a route
app.get('/api/data', (req, res) => {
connection.query('SELECT * FROM tourcompany', (err, results) => {
if (err) throw err;
res.json(results);
});
});

app.listen(port, () => {
console.log(`Server running at http://localhost:${port}`);
});