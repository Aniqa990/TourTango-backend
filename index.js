const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const port = 3000;

// Enable CORS for your Flutter app
app.use(cors());

// Database connection
const pool = mysql.createPool({
    host: 'localhost',  
    user: 'root',  
    password: '',  
    database: 'TourTango', 
    port: 3306,  
    waitForConnections: true,
    connectionLimit: 80, 
    queueLimit: 0
});

const promisePool = pool.promise();


app.get('/home', async (req, res) => {
    try {
        const [tourPackages] = await promisePool.query('SELECT * FROM tourPackage');
        const [topPackages] = await promisePool.query('SELECT * FROM tourPackage LIMIT 5');

        res.json({ tourPackages, topPackages });
    } catch (error) {
        console.error('Error fetching home data:', error);
        res.status(500).send('Error fetching data');
    }
});


// app.post('/addPackage', async (req, res) => {
//     try {
//         const {
//             name,
//             price,
//             availability,
//             tourCompanyID,
//             start_date,
//             end_date,
//             transportID,
//             guideID,
//             country
//         } = req.body;

//         // Insert the new package into the database
//         await new Promise((resolve, reject) => {
//             const query = `
//                 INSERT INTO tourPackage (name, price, availability, tourCompanyID, start_date, end_date, transportID, guideID, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
//             `;
//             connection.query(
//                 query,
//                 [name, price, availability, tourCompanyID, start_date, end_date, transportID, guideID, country],
//                 (error, results) => {
//                     if (error) reject(error);
//                     else resolve(results);
//                 }
//             );
//         });

//         res.status(201).json({ message: 'Package added successfully' });
//     } catch (error) {
//         console.error('Error adding package:', error);
//         res.status(500).send('Error adding package');
//     }
// });

app.post("/company_signup", async (req, res) => {
    const { companyName, website, email, password } = req.body;

    if (!companyName || !email || !password) {
        return res.status(400).send("All fields are required");
    }

    try {
        const query = `
            INSERT INTO tourCompany (companyName, website, email, password) VALUES (?, ?, ?, ?);
        `;
        const connection = await promisePool.getConnection();
        try {
            await connection.query(query, [companyName, website, email, password]);
            res.status(200).send("User signed up successfully");
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error("Error handling signup:", error);
        res.status(500).send("Server error");
    }
});

app.route('/packages')
    .get(async (req, res) => {
        try {
            const connection = await promisePool.getConnection();
            try {
                const query = 'SELECT * FROM tourPackage';
                const [results] = await connection.query(query);
                res.json(results);
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error fetching packages:', error);
            res.status(500).send('Error fetching packages');
        }
    })
    .post(async (req, res) => {
        try {
            const {
                name,
                price,
                availability,
                start_date,
                end_date,
                country,
                vehicleType,
                driverName,
                pickupLocation,
                companyName,
                guideName,
                website,
            } = req.body;

            const connection = await promisePool.getConnection();
            try {
                // Fetch company ID
                const companyQuery = `
                    SELECT companyID
                    FROM tourCompany
                    WHERE companyName = ? AND website = ?
                    LIMIT 1;
                `;
                const [tourCompanyResult] = await connection.query(companyQuery, [companyName, website]);
                if (tourCompanyResult.length === 0) {
                    return res.status(400).json({ message: 'Company not found' });
                }
                const tourCompanyID = tourCompanyResult[0].companyID;

                const guideQuery = `
                    SELECT guideID
                    FROM Guide
                    WHERE name = ? AND availability = ?
                    LIMIT 1;
                `;
                const [guideResult] = await connection.query(guideQuery, [guideName, 'Y']);
                if (guideResult.length === 0) {
                    return res.status(400).json({ message: 'Guide not found' });
                }
                const guideID = guideResult[0].guideID;

                // Fetch transport ID
                const transportQuery = `
                    SELECT transportID
                    FROM Transportation
                    WHERE vehicleType = ? AND driverName = ? AND pickupLocation = ?
                    LIMIT 1;
                `;
                const [transportResult] = await connection.query(transportQuery, [vehicleType, driverName, pickupLocation]);
                if (transportResult.length === 0) {
                    return res.status(400).json({ message: 'Transport not found' });
                }
                const transportID = transportResult[0].transportID;

                // Insert package
                const insertPackageQuery = `
                    INSERT INTO tourPackage (name, price, availability, tourCompanyID, start_date, end_date, transportID, guideID, country)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                `;
                await connection.query(insertPackageQuery, [name, price, availability, tourCompanyID, start_date, end_date, transportID, guideID, country]);

                res.status(201).json({ message: 'Package added successfully' });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error adding package:', error);
            res.status(500).json({ message: 'Error adding package', error: error.message });
        }
    });


    // Specific Package Operations
app.route('/packages/:id')
// Fetch details of a specific package
.get(async (req, res) => {
    try {
        const { id } = req.params;
        const query = 'SELECT * FROM tourPackage WHERE id = ?';
        const [results] = await pool.promise().query(query, [id]);
        if (results.length === 0) {
            return res.status(404).send('Package not found');
        }
        res.json(results[0]);
    } catch (error) {
        console.error('Error fetching package details:', error);
        res.status(500).send('Error fetching package details');
    }
})
// Update a package
.put(async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, availability, start_date, end_date, country } = req.body;
        const query = `
            UPDATE tourPackage
            SET name = ?, price = ?, availability = ?, start_date = ?, end_date = ?, country = ?
            WHERE id = ?`;
        await pool.promise().query(query, [name, price, availability, start_date, end_date, country, id]);
        res.status(200).send('Package updated successfully');
    } catch (error) {
        console.error('Error updating package:', error);
        res.status(500).send('Error updating package');
    }
})
// Delete a package
.delete(async (req, res) => {
    try {
        const { id } = req.params;
        const query = 'DELETE FROM tourPackage WHERE id = ?';
        await pool.promise().query(query, [id]);
        res.status(200).send('Package deleted successfully');
    } catch (error) {
        console.error('Error deleting package:', error);
        res.status(500).send('Error deleting package');
    }
});

// Route for Tour Guides
app.route('/guides')
// Fetch all guides
.get(async (req, res) => {
    try {
        const query = 'SELECT * FROM Guide';
        const [results] = await pool.promise().query(query);
        res.json(results);
    } catch (error) {
        console.error('Error fetching guides:', error);
        res.status(500).send('Error fetching guides');
    }
})
// Add a new guide
.post(async (req, res) => {
    try {
        const { name, availability } = req.body;
        const query = `INSERT INTO Guide (name, availability) VALUES (?, ?)`;
        await pool.promise().query(query, [name, availability]);
        res.status(201).send('Guide added successfully');
    } catch (error) {
        console.error('Error adding guide:', error);
        res.status(500).send('Error adding guide');
    }
});

// Close the pool when shutting down the server
process.on('SIGTERM', () => {
    pool.end((err) => {
        if (err) {
            console.error('Error closing the connection pool:', err);
        } else {
            console.log('Connection pool closed.');
        }
    });
});

process.on('SIGINT', () => {
    pool.end((err) => {
        if (err) {
            console.error('Error closing the connection pool:', err);
        } else {
            console.log('Connection pool closed.');
        }
    });
});



  
  


// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

module.exports = app;