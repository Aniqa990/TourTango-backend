// const express = require('express');
// const mysql = require('mysql');
// const app = express();
// const port = 3000;

// // MySQL connection
// const connection = mysql.createConnection({
// host: 'localhost',
// user: 'root',
// password: '',
// database: 'tourtango'
// });

// connection.connect((err) => {
// if (err) throw err;
// console.log('Connected to MySQL database!');
// });

// app.use(express.json());

// // Define a route
// app.get('/api/data', (req, res) => {
// connection.query('SELECT * FROM tourcompany', (err, results) => {
// if (err) throw err;
// res.json(results);
// });
// });

// app.listen(port, () => {
// console.log(`Server running at http://localhost:${port}`);
// });


const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const port = 3000;

// Enable CORS for your Flutter app
app.use(cors());

// Database connection
const connection = mysql.createConnection({
    host: 'sql.freedb.tech',
    user: 'freedb_tourtango',
    password: 'S#XxJTpFCt2yWj3',
    database: 'freedb_TourTango',
    port: 3306,
});

// Connect to the database
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

// Sample route to fetch data
app.get('/data', (req, res) => {
    const query = 'SELECT * FROM tourCompany'; // Replace 'your_table' with your table name
    connection.query(query, (error, results) => {
        if (error) {
            res.status(500).send('Database query error');
            return;
        }
        res.json(results);
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
