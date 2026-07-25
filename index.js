const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const SSLCommerzPayment = require("sslcommerz-lts");
const admin = require("firebase-admin");
const multer = require("multer");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 5000;

dotenv.config();

// Initialize Firebase Admin
// const serviceAccount = require("./firebase-admin-key.json");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8",
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://prokritirbazar-client.vercel.app",
    ],
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

//middleware token
const verifyFBToken = async (req, res, next) => {
  console.log("bearer", req.headers?.authorization);
  const token = req.headers?.authorization;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    console.log("decoded in the token", decoded);
    req.decoded_email = decoded.email;
    next();
  } catch (error) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Pass}@cluster0.jdtyh.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const store_id = process.env.SSL_STORE_ID || "testbox";
    const store_passwd = process.env.SSL_STORE_PASS || "qwerty";
    const is_live = process.env.SSL_IS_LIVE === "true";
    const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
    const SERVER_URL =
      process.env.SERVER_URL || "https://prokritirbazar-server.vercel.app";

    const db = client.db("prokritir_bazar");
    const usersCollection = db.collection("users");
    const ordersCollection = db.collection("orders");
    const productsCollection = db.collection("products");
    const reviewsCollection = db.collection("reviews");

    // Create index for email (unique)
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await ordersCollection.createIndex({ customer_email: 1 });
    await ordersCollection.createIndex({ created_date: -1 });
    await productsCollection.createIndex({ created_date: -1 });

    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const findUserByEmail = async (email) => {
      if (!email) return null;
      const normalized = email.trim().toLowerCase();
      return usersCollection.findOne({
        email: { $regex: new RegExp(`^${escapeRegex(normalized)}$`, "i") },
      });
    };

    const findRiderByEmail = async (email, status) => {
      if (!email) return null;
      const normalized = email.trim().toLowerCase();
      const query = {
        email: { $regex: new RegExp(`^${escapeRegex(normalized)}$`, "i") },
      };
    };

    //middle ware

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await usersCollection.findOne(query);

      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }

      next();
    };

    // POST: Create or update user
    //user api
    app.get("/users", verifyFBToken, async (req, res) => {
      const searchText = req.query.searchText;
      const query = {};
      if (searchText) {
        // query.displayName = {$regex: searchText, $options: 'i'}

        query.$or = [
          {
            displayName: { $regex: searchText, $options: "i" },
          },
          {
            email: { $regex: searchText, $options: "i" },
          },
        ];
      }

      const cursor = usersCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/users/:id", verifyFBToken, async (req, res) => {});

    app.get("/users/:email/role", verifyFBToken, async (req, res) => {
      const email = decodeURIComponent(req.params.email).trim().toLowerCase();
      const decodedEmail = req.decoded_email.trim().toLowerCase();

      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const user = await findUserByEmail(decodedEmail);

      if (!user) {
        return res.send({ role: "user" });
      }

      if (user.role === "admin") {
        return res.send({ role: "admin" });
      }

      const approvedRider = await findRiderByEmail(decodedEmail, "approved");

      if (approvedRider && user.role !== "rider") {
        await usersCollection.updateOne(
          { _id: user._id },
          { $set: { role: "rider" } },
        );
        return res.send({ role: "rider" });
      }

      res.send({ role: user.role || "user" });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      user.email = user.email?.trim().toLowerCase();
      user.createAt = new Date();
      const email = user.email;
      const existingUser = await findUserByEmail(email);
      const approvedRider = await findRiderByEmail(email, "approved");

      if (existingUser) {
        // approve আগে হয়ে login পরে হলে role user থেকে যায় — এখানে ঠিক করা
        if (
          approvedRider &&
          existingUser.role !== "admin" &&
          existingUser.role !== "rider"
        ) {
          await usersCollection.updateOne(
            { _id: existingUser._id },
            { $set: { role: "rider" } },
          );
        }
        return res.send({ message: "User already exists" });
      }

      user.role = approvedRider ? "rider" : "user";
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // User role update API
    app.patch(
      "/users/:id/role",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const { role } = req.body;
        const filter = { _id: new ObjectId(id) };

        const user = await usersCollection.findOne(filter);

        let finalRole = role;

        if (role === "user") {
          if (user.previousRole === "rider" || user.role === "rider") {
            finalRole = "rider";
          }
        } else if (role === "admin") {
          await usersCollection.updateOne(filter, {
            $set: { previousRole: user.role },
          });
        }

        const updatedDoc = {
          $set: {
            role: finalRole,
          },
        };

        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      },
    );

    // DELETE: Delete user by email
    app.delete("/users/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const result = await usersCollection.deleteOne({ email });

        if (result.deletedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "User not found",
          });
        }

        res.status(200).send({
          success: true,
          message: "User deleted successfully",
          result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // ============ ORDERS COLLECTION ============

    // POST: Create new order
    app.post("/orders", verifyFBToken, async (req, res) => {
      try {
        const orderData = req.body;
        orderData.created_date = new Date();
        orderData.customer_email = req.decoded_email;
        orderData.payment_status =
          orderData.payment_method === "ক্যাশ অন ডেলিভারি" ? "cod" : "unpaid";

        const result = await ordersCollection.insertOne(orderData);
        res.status(201).send({
          success: true,
          message: "Order created successfully",
          data: result,
        });
      } catch (error) {
        res.status(400).send({ success: false, message: error.message });
      }
    });

    // GET: Get orders by customer email or all orders for admin
    app.get("/orders", verifyFBToken, async (req, res) => {
      try {
        const { email } = req.query;
        const currentUser = await findUserByEmail(req.decoded_email);
        const isAdmin = currentUser?.role === "admin";

        let query = {};
        if (email) {
          query.customer_email = email;
        } else if (!isAdmin) {
          query.customer_email = req.decoded_email;
        }

        const { limit = 500 } = req.query;
        const orders = await ordersCollection
          .find(query)
          .sort({ created_date: -1 })
          .limit(parseInt(limit))
          .toArray();

        res.status(200).send({ success: true, data: orders });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // GET: Get order by ID
    app.get("/orders/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const order = await ordersCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!order) {
          return res.status(404).send({
            success: false,
            message: "Order not found",
          });
        }

        res.status(200).send({
          success: true,
          data: order,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // PATCH: Update order (admin only)
    app.patch("/orders/:id", verifyFBToken, verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;

        // এখানে _id ফিল্ডটিকে আলাদা করে বাকি ডাটা (updateData) আলাদা করা হলো
        const { _id, ...updateData } = req.body;

        const result = await ordersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }, // এখন আর _id এরর আসবে না
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Order not found",
          });
        }

        res.status(200).send({
          success: true,
          message: "Order updated successfully",
          data: result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // DELETE: Delete order
    app.delete("/orders/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const result = await ordersCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Order not found",
          });
        }

        res.status(200).send({
          success: true,
          message: "Order deleted successfully",
          data: result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // ============ PRODUCTS COLLECTION ============

    // POST: Upload image
    app.post("/upload-image", upload.single("image"), (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).send({
            success: false,
            message: "No file uploaded",
          });
        }

        const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

        res.status(200).send({
          success: true,
          url: imageUrl,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // GET: Get all products
    app.get("/products", async (req, res) => {
      try {
        const { sort = "-created_date", limit = 200 } = req.query;
        const products = await productsCollection
          .find({})
          .sort({ created_date: -1 })
          .limit(parseInt(limit))
          .toArray();

        res.status(200).send({
          success: true,
          data: products,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // POST: Create new product (admin only)
    app.post("/products", verifyFBToken, verifyAdmin, async (req, res) => {
      try {
        const productData = req.body;
        productData.created_date = new Date();

        const result = await productsCollection.insertOne(productData);
        res.status(201).send({
          success: true,
          message: "Product created successfully",
          data: result,
        });
      } catch (error) {
        res.status(400).send({
          success: false,
          message: error.message,
        });
      }
    });

    // GET: Get single product by ID
    app.get("/products/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const product = await productsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!product) {
          return res.status(404).send({
            success: false,
            message: "Product not found",
          });
        }

        res.status(200).send({
          success: true,
          data: product,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // PATCH: Update product (admin only)
    app.patch("/products/:id", verifyFBToken, verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        const updateData = req.body;

        const result = await productsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData },
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Product not found",
          });
        }

        res.status(200).send({
          success: true,
          message: "Product updated successfully",
          data: result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // DELETE: Delete product (admin only)
    app.delete(
      "/products/:id",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const { id } = req.params;
          const result = await productsCollection.deleteOne({
            _id: new ObjectId(id),
          });

          if (result.deletedCount === 0) {
            return res.status(404).send({
              success: false,
              message: "Product not found",
            });
          }

          res.status(200).send({
            success: true,
            message: "Product deleted successfully",
            data: result,
          });
        } catch (error) {
          res.status(500).send({
            success: false,
            message: error.message,
          });
        }
      },
    );
    // ============ REVIEWS COLLECTION ============

    // POST: নতুন রিভিউ তৈরি করা
    app.post("/reviews", async (req, res) => {
      try {
        const reviewData = req.body;
        reviewData.created_date = new Date(); // রিভিউ তৈরির সময় ব্যাকএন্ড থেকে সেট করা নিরাপদ

        const result = await reviewsCollection.insertOne(reviewData);
        res.status(201).send({
          success: true,
          message: "Review submitted successfully",
          data: result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // GET: প্রোডাক্ট আইডি অনুযায়ী সব রিভিউ নিয়ে আসা
    app.get("/reviews", async (req, res) => {
      try {
        const { product_id } = req.query;

        if (!product_id) {
          return res.status(400).send({
            success: false,
            message: "product_id parameter is required",
          });
        }

        const reviews = await reviewsCollection
          .find({ product_id: product_id })
          .sort({ created_date: -1 }) // নতুন রিভিউগুলো আগে দেখাবে
          .toArray();

        res.status(200).send({
          success: true,
          data: reviews,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // ============ SSL COMMERZ PAYMENT ============

    // Init SSL payment
    app.post("/ssl-payment", verifyFBToken, async (req, res) => {
      try {
        const { orderId } = req.body;
        const order = await ordersCollection.findOne({
          _id: new ObjectId(orderId),
        });

        if (!order) {
          return res.status(404).send({ message: "Order not found" });
        }

        const tran_id = new ObjectId().toString();

        const data = {
          total_amount: order.total_amount,
          currency: "BDT",
          tran_id: tran_id,
          success_url: `${SERVER_URL}/payment-success`,
          fail_url: `${SERVER_URL}/payment-fail`,
          cancel_url: `${SERVER_URL}/payment-cancel`,
          ipn_url: `${SERVER_URL}/ipn`,
          shipping_method: "Courier",
          product_name: "Prokritir Bazar Order",
          product_category: "Goods",
          product_profile: "general",
          cus_name: order.customer_name || "Customer",
          cus_email: order.customer_email || "test@gmail.com",
          cus_add1: order.address || "Dhaka",
          cus_city: order.district || "Dhaka",
          cus_country: "Bangladesh",
          cus_phone: order.customer_phone || "01700000000",
          ship_name: order.customer_name || "Customer",
          ship_add1: order.address || "Dhaka",
          ship_city: order.district || "Dhaka",
          ship_country: "Bangladesh",
          ship_postcode: "1200",
          value_a: orderId,
        };

        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
        const apiResponse = await sslcz.init(data);

        if (apiResponse?.GatewayPageURL) {
          await ordersCollection.updateOne(
            { _id: new ObjectId(orderId) },
            { $set: { tran_id, payment_status: "pending" } },
          );
          res.send({ url: apiResponse.GatewayPageURL });
        } else {
          res.status(400).send({
            message: "Failed to init SSL session",
            response: apiResponse,
          });
        }
      } catch (error) {
        console.log("SSL Error:", error);
        res.status(500).send({ error: error.message });
      }
    });

    // Payment success (SSL POSTs here)
    app.post("/payment-success", async (req, res) => {
      const data = req.body || {};

      // ডাটা না এলে বা ভুল হলে redirect করে দাও
      if (!data.value_a) {
        return res.redirect(`${CLIENT_URL}/checkout?payment=fail`);
      }

      // SSLCommerz সফল হলে status: "VALID" বা "SUCCESS" পাঠায়
      if (data.status === "VALID" || data.status === "SUCCESS") {
        await ordersCollection.updateOne(
          { _id: new ObjectId(data.value_a) },
          {
            $set: {
              payment_status: "paid",
              tran_id: data.tran_id,
              paid_at: new Date(),
            },
          },
        );
      }

      res.redirect(`${CLIENT_URL}/checkout?payment=success`);
    });

    // Payment fail
    app.post("/payment-fail", async (req, res) => {
      const data = req.body || {};
      if (data.value_a) {
        await ordersCollection.updateOne(
          { _id: new ObjectId(data.value_a) },
          { $set: { payment_status: "failed" } },
        );
      }
      res.redirect(`${CLIENT_URL}/checkout?payment=fail`);
    });

    // Payment cancel
    app.post("/payment-cancel", async (req, res) => {
      const data = req.body || {};
      if (data.value_a) {
        await ordersCollection.updateOne(
          { _id: new ObjectId(data.value_a) },
          { $set: { payment_status: "cancelled" } },
        );
      }
      res.redirect(`${CLIENT_URL}/checkout?payment=cancel`);
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Prokritir Bazar Server is running...");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
