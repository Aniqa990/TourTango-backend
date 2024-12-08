const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const schedule = require('node-schedule');
const { format } = require('date-fns');

const app = express();

const port = 3000;

// Enable CORS for your Flutter app
app.use(cors());
app.use(express.json());


// Database connection
const pool = mysql.createPool({
    host: 'localhost',  
    user: 'root',  
    password: '',  
    database: 'tourtango', 
    port: 3306,  
    waitForConnections: true,
    connectionLimit: 80, 
    queueLimit: 0
});

const promisePool = pool.promise();


app.get('/:customerEmail/home', async (req, res) => {
    try {

        const { customerEmail } = req.params;
        const connection = await promisePool.getConnection();
        try {
            // Get companyID from email
            const customerQuery = 'SELECT customerID FROM customer WHERE email = ?';
            const [customerResult] = await connection.query(customerQuery, [customerEmail]);
            if (customerResult.length === 0) {
                return res.status(404).json({ message: 'Customer not found' });
            }
            const customerID = customerResult[0].customerID;

            // Fetch packages, bookings
            const [tourPackages] = await connection.query('SELECT * FROM tourPackage t left join guide g on g.guideID=t.guideID left join transportation tr on tr.transportID=t.transportID left join tourpackage_flight tf on t.packageID=tf.tourPackageID left join flight f on f.flightID=tf.flightID left join accommodation a on a.accommodationID = t.accommodationID');
            const [topPackages] = await connection.query('SELECT * FROM tourPackage t left join guide g on g.guideID=t.guideID left join transportation tr on tr.transportID=t.transportID left join tourpackage_flight tf on t.packageID=tf.tourPackageID left join flight f on f.flightID=tf.flightID left join accommodation a on a.accommodationID = t.accommodationID LIMIT 5');
            const [bookings] = await connection.query('SELECT * FROM booking WHERE customerID = ?', [customerID]);
            const [faqs] = await connection.query('SELECT * FROM faqs');
            const transportQuery = 'SELECT * FROM transportation where companyID = ?';
            //const [guides] = await connection.query(guideQuery, [companyID]);
            //const [transport] = await connection.query(transportQuery, [companyID]);
            res.json({ tourPackages, topPackages, bookings, faqs });
    } finally {
        connection.release();
    }}
    catch (error) {
        console.error('Error fetching home data:', error);
        res.status(500).send('Error fetching data');
    }
});

//add itinerary
app.route('/itinerary')
.get(async (req, res) => {
    try {
        const query = 'SELECT * FROM itinerary';
        const [results] = await pool.promise().query(query);
        if (results.length === 0) {
            return res.status(404).send('Itineraries not found');
        }
        res.json(results);
    } catch (error) {
        console.error('Error fetching itinerary details:', error);
        res.status(500).send('Error fetching itinerary details');
    }
})
.post(async (req, res) => {
    try {

      const {
        activity,
        description,
        time_of_day,
        date,
        city
      } = req.body;

      const formattedDate = format(new Date(date), 'yyyy-MM-dd');

    await promisePool.query(
        `INSERT INTO itinerary (activity_name, description, time_of_day, date, city) 
        VALUES (?, ?, ?, ?, ?)`,
        [activity, description, time_of_day, formattedDate, city]
      );
  
      res.status(201).send('Itinerary added successfully');
    } catch (error) {
      console.error(error);
      res.status(500).send('Error adding itinerary');
    }
  });

app.post('/:companyEmail/addPackage', async (req, res) => {
    try {

        const {companyEmail} = req.params;

      const {
        packageName,
        price,
        availability,
        description,
        start_date,
        end_date,
        country,
        guideID,
        transportID,
        accommodationID,
        package_limit,
        image_url,
        flightIDs,
        itineraryIDs,
        itineraryDates,
        itineraryTimeOfDay
      } = req.body;

      const companyQuery = 'SELECT companyID FROM tourCompany WHERE email = ?';
        const [companyResult] = await promisePool.query(companyQuery, [companyEmail]);
        if (companyResult.length === 0) {
            return res.status(404).json({ message: 'Company not found' });
        }
        const companyID = companyResult[0].companyID;

        const formattedstartDate = format(new Date(start_date), 'yyyy-MM-dd');
        const formattedendDate = format(new Date(end_date), 'yyyy-MM-dd');

  
      // Insert package details into the tour package table
      const [packageInsert] = await promisePool.query(
        `INSERT INTO tourpackage (packageName, price, availability, description, start_date, end_date, country, guideID, transportID, accommodationID, tourCompanyID, customerLimit, imageUrl) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [packageName, price, availability, description, formattedstartDate, formattedendDate, country, guideID, transportID, accommodationID, companyID, package_limit, image_url]
      );
  
      // Now insert flight connections in the tourpackage_flight table
      const packageID = packageInsert.insertId; // Assuming auto-increment field for package_id
  
      for (const flightID of flightIDs) {
        await promisePool.query(
          `INSERT INTO tourpackage_flight (tourPackageID, flightID) VALUES (?, ?)`,
          [packageID, flightID]
        );
      }

      for (let i = 0; i < itineraryIDs.length; i++) {
        const itineraryID = itineraryIDs[i];
        const itineraryDate = itineraryDates[i];
        const itineraryt_o_d = itineraryTimeOfDay[i];
        const formattedDate = format(new Date(itineraryDate), 'yyyy-MM-dd');
      
        await promisePool.query(
          `INSERT INTO tourpackage_itinerary (packageID, itineraryID, itinerary_date, itinerary_time_of_day) VALUES (?, ?, ?, ?)`,
          [packageID, itineraryID, formattedDate, itineraryt_o_d]
        );
      }
  
      res.status(201).send('Package added successfully');
    } catch (error) {
      console.error(error);
      res.status(500).send('Error adding package');
    }
  });
  


app.route('/:companyEmail/details')
    .get(async (req, res) => {
        try {
            const { companyEmail } = req.params;
            const connection = await promisePool.getConnection();
            try {
                // Get companyID from email
                const companyQuery = 'SELECT companyID FROM tourCompany WHERE email = ?';
                const [companyResult] = await connection.query(companyQuery, [companyEmail]);
                if (companyResult.length === 0) {
                    return res.status(404).json({ message: 'Company not found' });
                }
                const companyID = companyResult[0].companyID;

                // Fetch packages and guides
                const packageQuery = 'SELECT * FROM tourPackage t left join guide g on g.guideID=t.guideID left join transportation tr on tr.transportID=t.transportID left join tourpackage_flight tf on t.packageID=tf.tourPackageID left join flight f on f.flightID=tf.flightID left join accommodation a on a.accommodationID = t.accommodationID left join tourpackage_itinerary ti on ti.packageID=t.packageID left join itinerary i on ti.itineraryID = i.itineraryID WHERE t.tourCompanyID = ?';
                const guideQuery = 'SELECT * FROM Guide where companyID = ?';
                const transportQuery = 'SELECT * FROM transportation where companyID = ?';
                const [packages] = await connection.query(packageQuery, [companyID]);
                const [guides] = await connection.query(guideQuery, [companyID]);
                const [transport] = await connection.query(transportQuery, [companyID]);

                res.json({ packages, guides, transport });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error fetching company details:', error);
            res.status(500).json({ message: 'Error fetching details', error: error.message });
        }
    });

// Specific Package Operations
app.route('/packages/:id')
// Fetch details of a specific package
.get(async (req, res) => {
    try {
        const { id } = req.params;
        const query = 'SELECT * FROM tourPackage t left join guide g on g.guideID=t.guideID left join transportation tr on tr.transportID=t.transportID left join tourpackage_flight tf on t.packageID=tf.tourPackageID left join flight f on f.flightID=tf.flightID left join accommodation a on a.accommodationID = t.accommodationID WHERE t.packageID = ?';
        const itineraryQuery = `SELECT i.* FROM itinerary i JOIN tourpackage_itinerary ti ON ti.itineraryID = i.itineraryID WHERE ti.packageID = ?`;
        const [results] = await pool.promise().query(query, [id]);
        const [itinerary] = await promisePool.query(itineraryQuery, [id]);
        
        if (results.length === 0) {
            return res.status(404).send('Package not found');
        }
        res.json({...results[0], itinerary});
    } catch (error) {
        console.error('Error fetching package details:', error);
        res.status(500).send('Error fetching package details');
    }
})
// Update a package
.put(async (req, res) => {
    try {
        const { id } = req.params;
        const {
            packageName,
            price,
            availability,
            description,
            start_date,
            end_date,
            country,
            guideID,
            transportID,
            accommodationID,
            package_limit,
            image_url,
            flightIDs,
            itineraryIDs,
            itineraryDates,
            itineraryTimeOfDay
          } = req.body;

    
            const formattedstartDate = format(new Date(start_date), 'yyyy-MM-dd');
            const formattedendDate = format(new Date(end_date), 'yyyy-MM-dd');
    
      
          // Insert package details into the tour package table
          await promisePool.query(
            `UPDATE tourpackage SET packageName=? , price=?, availability=?, description=?, start_date=?, end_date=?, country=?, guideID=?, transportID=?, accommodationID=?, customerLimit=?, imageUrl=? where packageID = ?`,
            [packageName, price, availability, description, formattedstartDate, formattedendDate, country, guideID, transportID, accommodationID, package_limit, image_url, id]
          );
      
          // Now insert flight connections in the tourpackage_flight table, removing previous flights
            await promisePool.query(
              `DELETE FROM tourpackage_flight where tourPackageID = ?`,
              [id]
            );
      
          for (const flightID of flightIDs) {
            await promisePool.query(
              `INSERT INTO tourpackage_flight (tourPackageID, flightID) VALUES (?, ?)`,
              [id, flightID]
            );
          }
    
          await promisePool.query(
            `DELETE FROM tourpackage_itinerary where packageID = ?`,[id]
          );

          for (let i = 0; i < itineraryIDs.length; i++) {
            const itineraryID = itineraryIDs[i];
            const itineraryDate = itineraryDates[i];
            const itineraryt_o_d = itineraryTimeOfDay[i];
            const formattedDate = format(new Date(itineraryDate), 'yyyy-MM-dd');
          
            await promisePool.query(
              `INSERT INTO tourpackage_itinerary (packageID, itineraryID, itinerary_date, itinerary_time_of_day) VALUES (?, ?, ?, ?)`,
              [id, itineraryID, formattedDate, itineraryt_o_d]
            );
          }
      
          res.status(201).send('Package update successfully');
        } catch (error) {
          console.error(error);
          res.status(500).send('Error updating package');
        }
})
// Delete a package
.delete(async (req, res) => {
    try {
        const { id } = req.params;
        const query = 'DELETE FROM tourPackage WHERE packageID = ?';
        await pool.promise().query(query, [id]);
        res.status(200).send('Package deleted successfully');
    } catch (error) {
        console.error('Error deleting package:', error);
        res.status(500).send('Error deleting package');
    }
});

app.get('/:customerEmail/favourites', async (req, res) => {
    try {
    const {customerEmail} = req.params;

  if (!customerEmail) {
    return res.status(400).json({ error: 'Missing customerEmail or packageId' });
  }
    const connection = await promisePool.getConnection();
    try{
    const customerQuery = 'SELECT customerID FROM customer WHERE email = ?';
    const [customerResult] = await connection.query(customerQuery, [customerEmail]);
    if (customerResult.length === 0) {
        return res.status(404).json({ message: 'Customer not found' });
    }
    const customerID = customerResult[0].customerID;

    const [results] = await connection.query('SELECT * from tourPackage t join favourites f on f.tourPackageID = t.packageID where f.customerID = ?', [customerID]);
    res.status(200).json(results);
  } finally {
                connection.release();
            }
    }catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching favourites.' });
  }
})

app.route('/:customerEmail/favourites/:packageId')
// Add to favourites
.post(async (req, res) => {
    try {
    const {customerEmail, packageId} = req.params;

  if (!customerEmail || !packageId) {
    return res.status(400).json({ error: 'Missing customerEmail or packageId' });
  }
    const connection = await promisePool.getConnection();
    try{
    const customerQuery = 'SELECT customerID FROM customer WHERE email = ?';
    const [customerResult] = await connection.query(customerQuery, [customerEmail]);
    if (customerResult.length === 0) {
        return res.status(404).json({ message: 'Customer not found' });
    }
    const customerID = customerResult[0].customerID;

    await connection.query('INSERT INTO favourites (customerID, tourPackageID) VALUES (?, ?)', [customerID, packageId]);
    res.status(200).json({ message: 'Package added to favourites.' });
  } finally {
                connection.release();
            }
    }catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error adding package to favourites.' });
  }
})
// Delete favourite
.delete(async (req, res) => {
    try {
    const {customerEmail, packageId} = req.params;

  if (!customerEmail || !packageId) {
    return res.status(400).json({ error: 'Missing customerEmail or packageId' });
  }
    const connection = await promisePool.getConnection();
    try{
    const customerQuery = 'SELECT customerID FROM customer WHERE email = ?';
    const [customerResult] = await connection.query(customerQuery, [customerEmail]);
    if (customerResult.length === 0) {
        return res.status(404).json({ message: 'Customer not found' });
    }
    const customerID = customerResult[0].customerID;

    await connection.query('DELETE FROM favourites WHERE customerID = ? AND tourPackageID = ?', [customerID, packageId]);
    res.status(200).json({ message: 'Package deleted from favourites.' });
  } finally {
                connection.release();
            }
    }catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error deleting package from favourites.' });
  }
});


// Route for Tour Guides
app.route(':companyEmail/guides')
// Fetch all guides
.get(async (req, res) => {
    try {
        const { companyEmail } = req.params;
        const connection = await promisePool.getConnection();
        try {
            // Get companyID from email
            const companyQuery = 'SELECT companyID FROM tourCompany WHERE email = ?';
            const [companyResult] = await connection.query(companyQuery, [companyEmail]);
            if (companyResult.length === 0) {
                return res.status(404).json({ message: 'Company not found' });
            }
            const companyID = companyResult[0].companyID;
            // Fetch packages and guides
            const query = 'SELECT * FROM Guide where companyID = ?';
            const [results] = await pool.promise().query(query, [companyID]);
            res.json(results);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error fetching guides:', error);
        res.status(500).send('Error fetching guides');
    }
})
// Add a new guide
.post(async (req, res) => {
    try {
        const { companyEmail } = req.params;
        const { guideName, guideAvailability } = req.body;
        try {
            // Get companyID from email
            const companyQuery = 'SELECT companyID FROM tourCompany WHERE email = ?';
            const [companyResult] = await connection.query(companyQuery, [companyEmail]);
            if (companyResult.length === 0) {
                return res.status(404).json({ message: 'Company not found' });
            }
            const companyID = companyResult[0].companyID;

            const query = `INSERT INTO Guide (guideName, guideAvailability, companyID) VALUES (?, ?, ?)`;
            await pool.promise().query(query, [guideName, guideAvailability, companyID]);
            res.status(201).send('Guide added successfully');
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error adding guide:', error);
        res.status(500).send('Error adding guide');
    }
});

    // Specific Guide Operations
    app.route('/guides/:id')
    // Fetch details of a specific guide
    .get(async (req, res) => {
        try {
            const { id } = req.params;
            const query = 'SELECT * FROM guide WHERE guideID = ?';
            const [results] = await pool.promise().query(query, [id]);
            if (results.length === 0) {
                return res.status(404).send('Guide not found');
            }
            res.json(results[0]);
        } catch (error) {
            console.error('Error fetching guide details:', error);
            res.status(500).send('Error fetching guide details');
        }
    })
    // Update a guide
    .put(async (req, res) => {
        try {
            const { id } = req.params;
            const { guideName, guideAvailability } = req.body;
            const query = `
                UPDATE guide
                SET guideName = ?,
                guideAvailability = ?
                WHERE guideID = ?`;
            await pool.promise().query(query, [guideName, guideAvailability, id]);
            res.status(200).send('Guide updated successfully');
        } catch (error) {
            console.error('Error updating guide:', error);
            res.status(500).send('Error updating guide');
        }
    })
    // Delete a guide
    .delete(async (req, res) => {
        try {
            const { id } = req.params;
            const query = 'DELETE FROM guide WHERE guideID = ?';
            await pool.promise().query(query, [id]);
            res.status(200).send('Guide deleted successfully');
        } catch (error) {
            console.error('Error deleting guide:', error);
            res.status(500).send('Error deleting guide');
        }
    });

    app.route(':companyEmail/transport')
    // Fetch all guides
    .get(async (req, res) => {
        try {
            const { companyEmail } = req.params;
            const connection = await promisePool.getConnection();
            try {
                // Get companyID from email
                const companyQuery = 'SELECT companyID FROM tourCompany WHERE email = ?';
                const [companyResult] = await connection.query(companyQuery, [companyEmail]);
                if (companyResult.length === 0) {
                    return res.status(404).json({ message: 'Company not found' });
                }
                const companyID = companyResult[0].companyID;
                // Fetch packages and guides
                const query = 'SELECT * FROM transportation where companyID = ?';
                const [results] = await pool.promise().query(query, [companyID]);
                res.json(results);
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error fetching transportation:', error);
            res.status(500).send('Error fetching transportation');
        }
    })
    // Add a new transport
    .post(async (req, res) => {
        try {
            const { companyEmail } = req.params;
            const { vehicleType, driverName, pickupLocation } = req.body;
            try {
                // Get companyID from email
                const companyQuery = 'SELECT companyID FROM tourCompany WHERE email = ?';
                const [companyResult] = await connection.query(companyQuery, [companyEmail]);
                if (companyResult.length === 0) {
                    return res.status(404).json({ message: 'Company not found' });
                }
                const companyID = companyResult[0].companyID;
    
                const query = `INSERT INTO transportation (vehicleType, driverName, pickupLocation, companyID) VALUES (?, ?, ?)`;
                await pool.promise().query(query, [vehicleType, driverName, pickupLocation, companyID]);
                res.status(201).send('Guide added successfully');
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error adding transport:', error);
            res.status(500).send('Error adding transport');
        }
    });

  // Specific Transport Operations
  app.route('/transport/:id')
  // Fetch details of a specific transport
  .get(async (req, res) => {
      try {
          const { id } = req.params;
          const query = 'SELECT * FROM transportation WHERE transportID = ?';
          const [results] = await pool.promise().query(query, [id]);
          if (results.length === 0) {
              return res.status(404).send('Transport not found');
          }
          res.json(results[0]);
      } catch (error) {
          console.error('Error fetching transport details:', error);
          res.status(500).send('Error fetching transport details');
      }
  })
  // Update a transport
  .put(async (req, res) => {
      try {
          const { id } = req.params;
          const { vehicleType, driverName, pickupLocation} = req.body;
          const query = `
              UPDATE transportation
              SET vehicleType = COALESCE(?, vehicleType),
                driverName = COALESCE(?, driverName),
                pickupLocation = COALESCE(?, pickupLocation),
              WHERE transportID = ?`;
          await pool.promise().query(query, [vehicleType, driverName, pickupLocation, id]);
          res.status(200).send('transport updated successfully');
      } catch (error) {
          console.error('Error updating transport:', error);
          res.status(500).send('Error updating transport');
      }
  })
  // Delete a transport
  .delete(async (req, res) => {
      try {
          const { id } = req.params;
          const query = 'DELETE FROM transportation WHERE transportID = ?';
          await pool.promise().query(query, [id]);
          res.status(200).send('transport deleted successfully');
      } catch (error) {
          console.error('Error deleting transport:', error);
          res.status(500).send('Error deleting transport');
      }
  });

  // Schedule a job to run daily at midnight
  schedule.scheduleJob('0 0 * * *', async () => {
    try {
        // Update guide availability
        await promisePool.query(`
            UPDATE Guides g
            JOIN TourPackages tp ON g.guideID = tp.guideID
            SET g.availability = 'Y'
            WHERE tp.end_date = CURDATE();
        `);

        // Delete expired packages
        await promisePool.query(`
            DELETE FROM TourPackages
            WHERE end_date = CURDATE();
        `);

        console.log("Expired packages processed successfully.");
    } catch (err) {
        console.error("Error processing expired packages:", err);
    }
});

app.route('/flights')
.get(async (req, res) => {
    try {
        const query = 'SELECT * FROM flight';
        const [results] = await pool.promise().query(query);
        if (results.length === 0) {
            return res.status(404).send('Flights not found');
        }
        res.json(results);
    } catch (error) {
        console.error('Error fetching flight details:', error);
        res.status(500).send('Error fetching flight details');
    }
})

// Fetch details of accommodations
app.route('/accommodation')
.get(async (req, res) => {
    try {
        const query = 'SELECT * FROM accommodation';
        const [results] = await pool.promise().query(query);
        if (results.length === 0) {
            return res.status(404).send('Accommodations not found');
        }
        res.json(results);
    } catch (error) {
        console.error('Error fetching accommodation details:', error);
        res.status(500).send('Error fetching accommodation details');
    }
})

// Get customer booking history
app.get('/:customerEmail/history', async (req, res) => {
    const customerEmail = req.params.customerEmail;
  
    // Query to get the customerID
    const [customerRows] = await promisePool.query('SELECT customerID FROM customer WHERE email = ?', [customerEmail]);
    
    // Check if customer was found
    if (customerRows.length === 0) {
      return res.status(404).send('Customer not found');
    }
    
    // Extract customerID
    const customerID = customerRows[0].customerID;
  
    // Define the query for booking history
    const query = 'SELECT * FROM booking_history h join customer c on  c.customerID = h.customer_id where h.customer_id = ?';
    
    try {
      // Fetch booking history based on the customerID
      const [results] = await promisePool.query(query, [customerID]);
  
      // Check if results are empty
      if (results.length === 0) {
        return res.status(404).send('History not found');
      }
  
      // Return the results
      res.json(results);
    } catch (err) {
      console.error(err);
      res.status(500).send('Error fetching booking history');
    }
  });


  //reviews
  app.post('/reviews', async(req, res) => {
    const { bookingId, rating, comment } = req.body;
    const query = 'INSERT INTO review (rating, comment) VALUES (?, ?)';
  
    await promisePool.query(query, [rating, comment], (err, result) => {
      if (err) {
        res.status(500).send('Error inserting review');
        return;
      }
  
      const reviewId = result.reviewID;
  
      // Update the booking with the review ID
      const updateQuery = 'UPDATE booking_history SET reviewID = ? WHERE history_ID = ?';
      promisePool.query(updateQuery, [reviewId, bId], (err) => {
        if (err) {
          res.status(500).send('Error updating booking with review ID');
          return;
        }
        res.status(200).send({ reviewId });
      });
    });
  })

  app.route('/reviews/:bookingID')
  .get(async (req, res) => {
    try {
        const { bookingID } = req.params;
        const query = 'SELECT * FROM review join booking b on b.reviewID = where bookingID = ?';
        const [results] = await pool.promise().query(query);
        if (results.length === 0) {
            return res.status(404).send('Accommodations not found');
        }
        res.json(results);
    } catch (error) {
        console.error('Error fetching accommodation details:', error);
        res.status(500).send('Error fetching accommodation details');
    }
})
  

//create booking
app.post('/createBookingTransaction', async (req, res) => {
    const { customerEmail, packageId, bookingDate, noOfPeople, paymentAmount, payment_mode } = req.body;

    try {
        // Retrieve the customerID based on email
        const [customerResult] = await promisePool.query('Select customerID from customer where email = ?', [customerEmail]);
        const customerID = customerResult[0]?.customerID;

        if (!customerID) {
            return res.status(400).json({ statusMessage: 'Customer not found.' });
        }

        // Start the transaction by calling the stored procedure
        await promisePool.query(
            'CALL CreateBookingTransaction(?, ?, ?, ?, ?, ?, @bookingID, @paymentID, @statusMessage)',
            [bookingDate, noOfPeople, packageId, customerID, paymentAmount, payment_mode]
        );

        // Retrieve the output variables
        const [outputResults] = await promisePool.query(
            'SELECT @bookingID AS bookingID, @paymentID AS paymentID, @statusMessage AS statusMessage'
        );

        const { bookingID, paymentID, statusMessage } = outputResults[0];

        res.json({
            statusMessage,
            bookingID,
            paymentID
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ statusMessage: 'Transaction failed and rolled back.' });
    }
});




// app.route('/:companyID/packages')
//     .get(async (req, res) => {
//         try {
//             const connection = await promisePool.getConnection();
//             try {
//                 const query = 'SELECT * FROM tourPackage where tourCompanyID = ?';
//                 const [results] = await connection.query(query, [companyID]);
//                 res.json(results);
//             } finally {
//                 connection.release();
//             }
//         } catch (error) {
//             console.error('Error fetching packages:', error);
//             res.status(500).send('Error fetching packages');
//         }
//     })
//     .post(async (req, res) => {
//         try {
//             const {
//                 name,
//                 price,
//                 availability,
//                 start_date,
//                 end_date,
//                 country,
//                 vehicleType,
//                 driverName,
//                 pickupLocation,
//                 companyName,
//                 guideName,
//                 website,
//             } = req.body;

//             const connection = await promisePool.getConnection();
//             try {
//                 // Fetch company ID
//                 const companyQuery = `
//                     SELECT companyID
//                     FROM tourCompany
//                     WHERE companyName = ? AND website = ?
//                     LIMIT 1;
//                 `;
//                 const [tourCompanyResult] = await connection.query(companyQuery, [companyName, website]);
//                 if (tourCompanyResult.length === 0) {
//                     return res.status(400).json({ message: 'Company not found' });
//                 }
//                 const tourCompanyID = tourCompanyResult[0].companyID;

//                 const guideQuery = `
//                     SELECT guideID
//                     FROM Guide
//                     WHERE name = ? AND availability = ?
//                     LIMIT 1;
//                 `;
//                 const [guideResult] = await connection.query(guideQuery, [guideName, 'Y']);
//                 if (guideResult.length === 0) {
//                     return res.status(400).json({ message: 'Guide not found' });
//                 }
//                 const guideID = guideResult[0].guideID;

//                 // Fetch transport ID
//                 const transportQuery = `
//                     SELECT transportID
//                     FROM Transportation
//                     WHERE vehicleType = ? AND driverName = ? AND pickupLocation = ?
//                     LIMIT 1;
//                 `;
//                 const [transportResult] = await connection.query(transportQuery, [vehicleType, driverName, pickupLocation]);
//                 if (transportResult.length === 0) {
//                     return res.status(400).json({ message: 'Transport not found' });
//                 }
//                 const transportID = transportResult[0].transportID;

//                 // Insert package
//                 const insertPackageQuery = `
//                     INSERT INTO tourPackage (name, price, availability, tourCompanyID, start_date, end_date, transportID, guideID, country)
//                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
//                 `;
//                 await connection.query(insertPackageQuery, [name, price, availability, tourCompanyID, start_date, end_date, transportID, guideID, country]);

//                 res.status(201).json({ message: 'Package added successfully' });
//             } finally {
//                 connection.release();
//             }
//         } catch (error) {
//             console.error('Error adding package:', error);
//             res.status(500).json({ message: 'Error adding package', error: error.message });
//         }
//     });

// // Route for Bookings
// app.route('/bookings')
// // Fetch all bookings
// .get(async (req, res) => {
//     try {
//         const query = 'SELECT * FROM Booking';
//         const [results] = await pool.promise().query(query);
//         res.json(results);
//     } catch (error) {
//         console.error('Error fetching bookings:', error);
//         res.status(500).send('Error fetching bookings');
//     }
// })
// // Add a new booking
// .post(async (req, res) => {
//     try {
//         const { customerID, paymentID, reviewID, confirmationStatus } = req.body;

//         // Insert new booking
//         const query = `
//             INSERT INTO Booking (BookingDate, confirmationStatus, customerID, paymentID, reviewID) 
//             VALUES (CURRENT_DATE, ?, ?, ?, ?);
//         `;
//         await pool.promise().query(query, [confirmationStatus, customerID, paymentID, reviewID]);

//         res.status(201).json({ message: 'Booking added successfully' });
//     } catch (error) {
//         console.error('Error adding booking:', error);
//         res.status(500).json({ message: 'Error adding booking', error: error.message });
//     }
// });

// // Specific Booking Operations
// app.route('/bookings/:id')
// // Cancel a booking
// .delete(async (req, res) => {
//     try {
//         const { id } = req.params;
//         const query = 'DELETE FROM Booking WHERE BookingID = ?';
//         await pool.promise().query(query, [id]);
//         res.status(200).send('Booking cancelled successfully');
//     } catch (error) {
//         console.error('Error canceling booking:', error);
//         res.status(500).send('Error canceling booking');
//     }
// });

  
// //Get customer name and the packages they have selected
// app.get('/customer-packages', async (req, res) => {
//     try {
//         const query = `
//             SELECT c.name AS customer_name, p.name AS package_name
//             FROM Customer c
//             INNER JOIN tourPackage_Customer tpc ON c.customerID = tpc.customerID
//             INNER JOIN tourPackage p ON tpc.packageID = p.packageID;
//         `;
//         const [results] = await pool.promise().query(query);
//         res.json(results);
//     } catch (error) {
//         console.error('Error fetching customer packages:', error);
//         res.status(500).send('Error fetching customer packages');
//     }
// });

// //Get package name, flight details (flightID, departure, arrival, company)
// app.get('/package-flights', async (req, res) => {
//     try {
//         const query = `
//             SELECT tp.name AS package_name, f.flightID, f.departureTime, f.arrivalTime, f.FlightCompany
//             FROM tourPackage tp
//             INNER JOIN tourPackage_Flight tpf ON tp.packageID = tpf.tourPackageID
//             INNER JOIN Flight f ON tpf.flightID = f.flightID;
//         `;
//         const [results] = await pool.promise().query(query);
//         res.json(results);
//     } catch (error) {
//         console.error('Error fetching package flights:', error);
//         res.status(500).send('Error fetching package flights');
//     }
// });

// //Get package details where tour company is 'specific'
// app.get('/adventure-travels-packages', async (req, res) => {
//     try {
//         const query = `
//             SELECT tp.name AS package_name, tp.price, tp.start_date, tp.end_date
//             FROM tourPackage tp
//             INNER JOIN tourCompany tc ON tp.tourCompanyID = tc.companyID
//             WHERE tc.companyName = ?;
//         `;
//         const [results] = await pool.promise().query(query);
//         res.json(results);
//     } catch (error) {
//         console.error('Error fetching Adventure Travels packages:', error);
//         res.status(500).send('Error fetching packages');
//     }
// });

// //Get customer name, booking details, payment status
// app.get('/customer-bookings', async (req, res) => {
//     try {
//         const query = `
//             SELECT c.name AS customer_name, b.BookingDate, b.confirmationStatus, p.amount, p.status_of_payment
//             FROM Customer c
//             INNER JOIN Booking b ON c.customerID = b.customerID
//             INNER JOIN payment p ON b.paymentID = p.paymentID;
//         `;
//         const [results] = await pool.promise().query(query);
//         res.json(results);
//     } catch (error) {
//         console.error('Error fetching customer bookings:', error);
//         res.status(500).send('Error fetching customer bookings');
//     }
// });

// //Get itinerary details for a specific package
// app.get('/package-itinerary/:id', async (req, res) => {
//     try {
//         const { id } = req.params;
//         const query = `
//             SELECT tp.name AS package_name, i.activity_name, i.date, i.time_of_day, i.city
//             FROM tourPackage tp
//             INNER JOIN tourPackage_Itinerary tpi ON tp.packageID = tpi.packageID
//             INNER JOIN Itinerary i ON tpi.itineraryID = i.itineraryID
//             WHERE tp.packageID = ?;
//         `;
//         const [results] = await pool.promise().query(query, [id]);
//         res.json(results);
//     } catch (error) {
//         console.error('Error fetching itinerary details:', error);
//         res.status(500).send('Error fetching itinerary details');
//     }
// });

// //Get customer reviews where booking is not confirmed
// app.get('/customer-reviews', async (req, res) => {
//     try {
//         const query = `
//             SELECT c.name AS customer_name, r.rating, r.comment
//             FROM Customer c
//             LEFT JOIN Booking b ON c.customerID = b.customerID
//             LEFT JOIN Review r ON b.reviewID = r.reviewID
//             WHERE b.confirmationStatus = 'N';
//         `;
//         const [results] = await pool.promise().query(query);
//         res.json(results);
//     } catch (error) {
//         console.error('Error fetching customer reviews:', error);
//         res.status(500).send('Error fetching customer reviews');
//     }
// });

// //Get guide details for a specific package where guide is available
// app.get('/package-guides/:id', async (req, res) => {
//     try {
//         const { id } = req.params;
//         const query = `
//             SELECT tp.name AS package_name, g.name AS guide_name
//             FROM tourPackage tp
//             INNER JOIN Guide g ON tp.guideID = g.guideID
//             WHERE tp.packageID = ? AND g.availability = 'Y';
//         `;
//         const [results] = await pool.promise().query(query, [id]);
//         res.json(results);
//     } catch (error) {
//         console.error('Error fetching guide details:', error);
//         res.status(500).send('Error fetching guide details');
//     }
// });

// //Get total amount paid by each customer
// app.get('/customer-total-payment', async (req, res) => {
//     try {
//         const query = `
//             SELECT c.name AS customer_name, SUM(p.amount) AS total_amount_paid
//             FROM Customer c
//             INNER JOIN Booking b ON c.customerID = b.customerID
//             INNER JOIN payment p ON b.paymentID = p.paymentID
//             GROUP BY c.name;
//         `;
//         const [results] = await pool.promise().query(query);
//         res.json(results);
//     } catch (error) {
//         console.error('Error fetching total payment by customer:', error);
//         res.status(500).send('Error fetching total payment by customer');
//     }
// });

// //Get customer details along with email and phone number
// app.get('/customer-details', async (req, res) => {
//     try {
//         const query = `
//             SELECT c.name AS customer_name, ce.email, cp.phoneNumber
//             FROM Customer c
//             LEFT JOIN Customer_Email ce ON c.customerID = ce.customerID
//             LEFT JOIN Customer_PhoneNumber cp ON c.customerID = cp.customerID;
//         `;
//         const [results] = await pool.promise().query(query);
//         res.json(results);
//     } catch (error) {
//         console.error('Error fetching customer details:', error);
//         res.status(500).send('Error fetching customer details');
//     }
// });

// //Get number of customers for each package
// app.get('/package-customers', async (req, res) => {
//     try {
//         const query = `
//             SELECT tp.name AS package_name, COUNT(tpc.customerID) AS number_of_customers
//             FROM tourPackage tp
//             LEFT JOIN tourPackage_Customer tpc ON tp.packageID = tpc.packageID
//             GROUP BY tp.name;
//         `;
//         const [results] = await pool.promise().query(query);
//         res.json(results);
//     } catch (error) {
//         console.error('Error fetching package customer count:', error);
//         res.status(500).send('Error fetching package customer count');
//     }
// });

// //Get booking details with payment status
// app.get('/booking-details', async (req, res) => {
//     try {
//         const query = `
//             SELECT b.BookingID, b.BookingDate, b.confirmationStatus, p.status_of_payment
//             FROM Booking b
//             INNER JOIN payment p ON b.paymentID = p.paymentID;
//         `;
//         const [results] = await pool.promise().query(query);
//         res.json(results);
//     } catch (error) {
//         console.error('Error fetching booking details:', error);
//         res.status(500).send('Error fetching booking details');
//     }
// });

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