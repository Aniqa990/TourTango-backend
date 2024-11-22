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

app.get('/home', async (req, res) => {
    try {
        // Execute multiple queries concurrently using Promise.all
        const [tourPackages, topPackages] = await Promise.all([
            new Promise((resolve, reject) => {
                const query = `
                    SELECT * FROM tourPackage;
                `;
                connection.query(query, (error, results) => {
                    if (error) reject(error);
                    else resolve(results);
                });
            }),
            new Promise((resolve, reject) => {
                const query = `
                    SELECT * FROM tourPackage LIMIT 5;
                `;
                connection.query(query, (error, results) => {
                    if (error) reject(error);
                    else resolve(results);
                });
            })
        ]);

        // Send the response with both the tour packages and the top-rated packages
        res.json({
            tourPackages,
            topPackages
        });
    } catch (error) {
        console.error('Error fetching home data:', error);
        res.status(500).send('Error fetching data');
    }
});

app.post('/addPackage', async (req, res) => {
    try {
        const {
            name,
            price,
            availability,
            tourCompanyID,
            start_date,
            end_date,
            transportID,
            guideID,
            country
        } = req.body;

        // Insert the new package into the database
        await new Promise((resolve, reject) => {
            const query = `
                INSERT INTO tourPackage (name, price, availability, tourCompanyID, start_date, end_date, transportID, guideID, country)
                VALUES (?, ?, ?, ?, STR_TO_DATE(?, '%Y-%m-%d'), STR_TO_DATE(?, '%Y-%m-%d'), ?, ?, ?);
            `;
            connection.query(
                query,
                [name, price, availability, tourCompanyID, start_date, end_date, transportID, guideID, country],
                (error, results) => {
                    if (error) reject(error);
                    else resolve(results);
                }
            );
        });

        res.status(201).json({ message: 'Package added successfully' });
    } catch (error) {
        console.error('Error adding package:', error);
        res.status(500).send('Error adding package');
    }
});


// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

module.exports = app;