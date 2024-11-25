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
      connection.query(query, [companyName, website, email, password], (error, results) => {
        if (error) {
          console.error("Error inserting user:", error);
          res.status(500).send("Error signing up");
        } else {
          res.status(200).send("User signed up successfully");
        }
      });
    } catch (error) {
      console.error("Error handling signup:", error);
      res.status(500).send("Server error");
    }
  });
  
  app.route('/packages')
  // Fetch all packages
  .get(async (req, res) => {
      try {
          const query = 'SELECT * FROM tourPackage';
          const [results] = await connection.promise().query(query);
          res.json(results);
      } catch (error) {
          console.error('Error fetching packages:', error);
          res.status(500).send('Error fetching packages');
      }
  })
  // Add a new package
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

          // Fetch company ID
          const companyQuery = `
              SELECT companyID
              FROM tourCompany
              WHERE companyName = ? AND website = ?
              LIMIT 1;
          `;
          const [tourCompanyResult] = await connection.promise().query(companyQuery, [companyName, website]);
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
          const [guideResult] = await connection.promise().query(guideQuery, [guideName, 'Y']);
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
          const [transportResult] = await connection.promise().query(transportQuery, [vehicleType, driverName, pickupLocation]);
          if (transportResult.length === 0) {
              return res.status(400).json({ message: 'Transport not found' });
          }
          const transportID = transportResult[0].transportID;

          // Insert package
          const insertPackageQuery = `
              INSERT INTO tourPackage (name, price, availability, tourCompanyID, start_date, end_date, transportID, guideID, country)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
          `;
          await connection.promise().query(insertPackageQuery, [name, price, availability, tourCompanyID, start_date, end_date, transportID, guideID, country]);

          res.status(201).json({ message: 'Package added successfully' });
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
          const [results] = await connection.promise().query(query, [id]);
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
          await connection.promise().query(query, [name, price, availability, start_date, end_date, country, id]);
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
          await connection.promise().query(query, [id]);
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
          const [results] = await connection.promise().query(query);
          res.json(results);
      } catch (error) {
          console.error('Error fetching guides:', error);
          res.status(500).send('Error fetching guides');
      }
  })
  .post(async (req, res) => {
      try {
          const { name, availability } = req.body;
          const query = `INSERT INTO Guide (name, availability) VALUES (?, ?)`;
          await connection.promise().query(query, [name, availability]);
          res.status(201).send('Guide added successfully');
      } catch (error) {
          console.error('Error adding guide:', error);
          res.status(500).send('Error adding guide');
      }
  });

  
  


// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

module.exports = app;