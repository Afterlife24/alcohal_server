const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();

var nm = require('nodemailer');
let savedOTPS = {};

app.use(cors());
app.use(bodyParser.json());

let db;
let client;

const uri = "mongodb+srv://Suraj:alcohal2002@suraj.2fxoc.mongodb.net/?retryWrites=true&w=majority&appName=suraj";



  app.get('/api/products/:id/quantity', async (req, res) => {
    const { id } = req.params;
    // console.log(`Received request to fetch quantity for product: ${id}`);
    
    try {
        const db = await getDatabase(); // Connect to the database
        const product = await db.collection('products').findOne({ productId: id });

        if (product) {
            // Product found, return the quantity
            return res.json({ quantity: product.quantity });
        } else {
            // Product not found, return 404
            return res.status(404).json({ error: `Product with ID ${id} not found` });
        }
    } catch (err) {
        console.error("Error fetching product:", err);
        return res.status(500).json({ error: "Server error while fetching product data" });
    }
  });

  app.get('/api/products', async (req, res) => {
    try {
        const db = await getDatabase(); // Ensure database connection
        const products = await db.collection('products').find({}).toArray();

        if (products.length > 0) {
            return res.json({ products });
        } else {
            return res.status(404).json({ error: "No products found" });
        }
    } catch (err) {
        console.error("Error fetching products:", err);
        return res.status(500).json({ error: "Server error while fetching products" });
    }
});

app.post("/api/products/update", async (req, res) => {
  const { productId, quantity } = req.body;

  if (!productId || quantity === undefined) {
    return res.status(400).json({ error: "Invalid product ID or quantity" });
  }

  try {
    const db = await getDatabase();
    const product = await db.collection("products").findOne({ productId });

    if (!product) {
      return res.status(404).json({ error: `Product with ID ${productId} not found` });
    }

    // Convert existing and new quantity to numbers, then store as a string
    const newQuantity = String(Number(product.quantity) + Number(quantity));

    await db.collection("products").updateOne(
      { productId },
      { $set: { quantity: newQuantity } }
    );

    res.json({ 
      message: `Quantity updated successfully! New quantity: ${newQuantity}`, 
      updatedQuantity: newQuantity 
    });
  } catch (err) {
    console.error("Error updating quantity:", err);
    res.status(500).json({ error: "Server error while updating quantity" });
  }
});


app.post("/api/products/add", async (req, res) => {
    const { productId, quantity } = req.body;

    if (!productId || quantity === undefined) {
        return res.status(400).json({ error: "Product ID and Quantity are required" });
    }

    try {
        const db = await getDatabase(); // Ensure database connection
        const existingProduct = await db.collection("products").findOne({ productId });

        if (existingProduct) {
            return res.status(400).json({ error: "Product ID already exists" });
        }

        await db.collection("products").insertOne({
            productId,
            quantity: String(quantity) // Store quantity as string
        });

        res.json({ message: "Product added successfully!" });
    } catch (err) {
        console.error("Error adding product:", err);
        res.status(500).json({ error: "Server error while adding product" });
    }
});

async function connectToMongo() {
    try {
        client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        db = client.db('alcohal'); // Replace with your database name
        console.log('Connected to MongoDB');
        startServer();
    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
        setTimeout(connectToMongo, 3000); // Retry connection after 3 seconds
    }
}



// Helper function to get database
const getDatabase = async () => {
    if (!db) {
        await connectToMongo();
    }
    return db;
};

// Delayed server start
function startServer() {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

// Endpoint to send the order
app.post('/sendOrders', async (req, res) => {
    console.log("Entered sendOrders");
    try {
        const { cart, shippingInfo } = req.body;

        if (!cart || !shippingInfo || !shippingInfo.email) {
            return res.status(400).json({ error: 'Invalid data received' });
        }

        console.log('Received Order Data:');
        console.log('Cart Items:');
        cart.forEach((item, index) => {
            console.log(`  ${index + 1}. Name: ${item.name}, Quantity: ${item.cartQuantity}, ID:${item.id}`);
        });
        console.log('Shipping Info:');
        console.log(`  Name: ${shippingInfo.name}`);
        console.log(`  Phone: ${shippingInfo.phone}`);
        console.log(`  Address: ${shippingInfo.address}`);
        console.log(`  Zip Code: ${shippingInfo.zipCode}`);
        console.log(`  Email: ${shippingInfo.email}`);

        const db = await getDatabase();

        for (const item of cart) {
            const productId = item.id; // Get the product ID
            const cartQuantity = item.cartQuantity; // Get the ordered quantity

            // Find the product in the database
            const product = await db.collection('products').findOne({ productId: productId });

            if (!product) {
                console.error(`Product with ID ${productId} not found`);
                continue; // Skip to the next item if the product is not found
            }

            // Check if the available quantity is sufficient
            if (product.quantity < cartQuantity) {
                console.error(`Insufficient quantity for product ${productId}. Available: ${product.quantity}, Ordered: ${cartQuantity}`);
                continue; // Skip to the next item if the quantity is insufficient
            }

            // Decrease the quantity in the database
            const newQuantity = product.quantity - cartQuantity;
            await db.collection('products').updateOne(
                { productId: productId },
                { $set: { quantity: newQuantity } }
            );

            console.log(`Updated product ${productId}. New quantity: ${newQuantity}`);
        }

        



        

        const newOrder = {
    cart,
    shippingInfo: {
        name: shippingInfo.name,
        phone: shippingInfo.phone,  // ✅ Phone number inserted correctly
        email: shippingInfo.email,
        address: shippingInfo.address,
        zipCode: shippingInfo.zipCode,
    },
    createdAt: new Date(),
    isShipped: false,
};

const result = await db.collection('Customer_orders').insertOne(newOrder);


        // Prepare email content
        const cartItems = cart.map(item => `${item.name} (Qty: ${item.cartQuantity})`).join(', ');
        const mailOptions = {
            from: 'youremail@gmail.com',
            to: shippingInfo.email,
            subject: "Order Confirmation",
            html: `
                <h1>Confirmation de commande</h1>
<p>Cher/Chère ${shippingInfo.name},</p>
<p>Merci pour votre commande ! Voici les détails de votre commande :</p>
<p><strong>Articles commandés :</strong> ${cartItems}</p>
<p><strong>Adresse de livraison :</strong> ${shippingInfo.address}, Code postal : ${shippingInfo.zipCode}</p>
<p>Nous espérons que vous apprécierez votre achat ! Si vous avez des questions, n'hésitez pas à nous contacter.</p>
<p>Cordialement,</p>
<p><strong>Votre Boutique</strong></p>
<img src='cid:orderImage' alt='Confirmation de commande' width='800px'>

            `,
            attachments: [
                 {
            filename: 'food.jpeg',
            path: "https://cdn.prod.website-files.com/605826c62e8de87de744596e/62fb492b87daf525c8b50dc7_Aug%2015%20Order%20Confirmation%20page%20best%20practices%20(%26%20great%20examples).jpg",
            cid: 'food'
        }
            ]
        };

        // Send email
        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.error("Error sending email:", error);
            } else {
                console.log("Email sent: " + info.response);
            }
        });

        res.status(200).json({ message: 'Order received and saved successfully', orderId: result.insertedId });
    } catch (error) {
        console.error("Error while processing the order:", error);
        res.status(500).json({ error: 'Error: ' + error.message });
    }
});



// Endpoint to mark an order as delivered
// Endpoint to mark an order as shipped
app.post("/markAsShipped", async (req, res) => {
    console.log("*******************Entered into mark as shipped*************************");
    try {
        const db = await getDatabase();
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ error: "Order ID is required" });
        }

        const result = await db.collection('Customer_orders').updateOne(
            { _id: new ObjectId(orderId) },
            { $set: { isShipped: true } } // Fixing field name to match order creation
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "Order not found" });
        }

        res.status(200).json({ message: "Order marked as shipped successfully" });
    } catch (error) {
        console.error("Error while marking order as shipped:", error);
        res.status(500).json({ error: "Error: " + error.message });
    }
});




// Get orders from the database
app.get("/getOrders", async (req, res) => {
    try {
        const db = await getDatabase();
        const orders = await db.collection('Customer_orders').find({}).toArray();
        res.status(200).json({ orders });
    } catch (error) {
        res.status(500).json({ error: "Error: " + error.message });
    }
});




// Get reservations from the database


// Server-Sent Events route for orders
app.get('/streamOrders', async (req, res) => {
    try {
        const db = await getDatabase();
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const sendEvent = (change) => {
            res.write(`data: ${JSON.stringify(change)}\n\n`);
        };

        const ordersChangeStream = db.collection('orders').watch();
        ordersChangeStream.on('change', sendEvent);

        req.on('close', () => {
            ordersChangeStream.removeAllListeners('change');
        });
    } catch (error) {
        res.status(500).json({ error: "Error: " + error.message });
    }
});




var transporter = nm.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: 'scanme684@gmail.com',
        pass: 'zvngultpfogdtbxj'
    }
});

app.post('/sendotp', (req, res) => {
    console.log("Check point 1");
    let email = req.body.email;
    let digits = '0123456789';
    let limit = 4;
    let otp = '';

    for (let i = 0; i < limit; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }

    console.log("Check point 2");
    var options = {
    from: 'yourmail@gmail.com',
    to: `${email}`,
    subject: "Email Verification Code",
    html: `
        <p>Cher utilisateur,</p>
<p>Nous espérons que ce message vous trouve en bonne santé. Veuillez utiliser le mot de passe à usage unique (OTP) ci-dessous pour vérifier votre adresse e-mail :</p>
<p><strong>${otp}</strong></p>
<p>Si vous n'avez pas demandé cette vérification, veuillez ignorer cet e-mail ou contacter notre équipe d'assistance pour obtenir de l'aide.</p>
<p>Merci d'avoir choisi notre service.</p>
<p>Cordialement,</p>
<p><strong>Le Kashmir</strong></p>

    `
};


    console.log("Check point 3");
    transporter.sendMail(options, function (error, info) {
        if (error) {
            console.log(error);
            return res.status(500).send("Couldn't send OTP"); // Use `return` to ensure no further response is sent.
        }

        savedOTPS[email] = otp;

        // Automatically delete OTP after 60 seconds
        setTimeout(() => {
            delete savedOTPS[email];
        }, 60000);

        console.log("OTP sent successfully");
        res.send("Sent OTP");
    });
    console.log("Check point 4");
});

app.post('/verify', (req, res) => {
    let otpReceived = req.body.otp;
    let email = req.body.email;

    if (savedOTPS[email] === otpReceived) {
        return res.send("Verified"); // Use `return` to ensure no further response is sent.
    } else {
        return res.status(500).send("Invalid OTP"); // Use `return` to ensure no further response is sent.
    }
});




// Initialize MongoDB connection
connectToMongo();



module.exports = app;
