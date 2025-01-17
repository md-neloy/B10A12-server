require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const stripe = require("stripe")(process.env.stripe_secrate_key);
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5050;

// middlewire
app.use(express.json());
app.use(cors());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fgiq9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
app.get("/", (req, res) => {
  res.send("Smart Leaning is Runningggg");
});

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    const AllClassesCollection = client
      .db("Smart-Learning")
      .collection("AllClasses");
    const feedbackCollection = client
      .db("Smart-Learning")
      .collection("feedback");
    const usersCollection = client.db("Smart-Learning").collection("users");
    const teachersCollection = client
      .db("Smart-Learning")
      .collection("teachers");
    const enrollCollection = client.db("Smart-Learning").collection("enroll");
    const assignmentsCollection = client
      .db("Smart-Learning")
      .collection("assignments");

    // token verify middlewire
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: `unauthorized access` });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.jwt_Token_Secrate, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after verify token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // user verify teacher after verify token
    const verifyTeacher = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isTeacher = user?.role === "teacher";
      if (!isTeacher) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // jwt related
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.jwt_Token_Secrate, {
        expiresIn: "24h",
      });
      res.send({ token });
    });

    // admin email verification
    app.get("/user/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user) {
        isAdmin = user?.role === "admin";
      }
      res.send({ isAdmin });
    });
    // teacher email verification
    app.get("/user/teacher/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isTeacher = false;
      if (user) {
        isTeacher = user?.role === "teacher";
      }
      res.send({ isTeacher });
    });

    // find all teacher or pending teacher for admin
    app.get("/rqTeacher", verifyToken, verifyAdmin, async (req, res) => {
      const limit = parseInt(req.query.limit);
      const page = parseInt(req.query.page);
      const skip = limit * page;
      // const query = { status: { $ne: "reject" } };
      const result = await teachersCollection
        .find()
        .skip(skip)
        .limit(limit)
        .toArray();
      res.send(result);
    });
    // find teachcollection length for admin pagination
    app.get("/techerRqCount", verifyToken, verifyAdmin, async (req, res) => {
      const result = await teachersCollection.countDocuments();
      res.send({ result });
    });
    // get all classes for admin by pagination
    app.get(
      "/getClasses-forAdmin",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const page = parseInt(req.query.page);
        const limit = parseInt(req.query.limit);
        const skip = page * limit;
        const query = { status: { $ne: "reject" } };
        const result = await AllClassesCollection.find(query)
          .skip(skip)
          .limit(limit)
          .toArray();
        res.send(result);
      }
    );

    // get class count for the admin pagination
    app.get(
      "/adminClassPagination",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const query = { status: { $ne: "reject" } };
        const result = await AllClassesCollection.countDocuments(query);
        res.send({ result });
      }
    );
    // approved or reject class by admin
    app.patch(
      "/approved-reject-class/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const message = req.query.message;
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        if (message === "approved") {
          const update = {
            $set: {
              status: "approved",
            },
          };
          const result = await AllClassesCollection.updateOne(query, update);
          res.send(result);
        } else {
          const update = {
            $set: {
              status: "reject",
            },
          };
          const result = await AllClassesCollection.updateOne(query, update);
          res.send(result);
        }
      }
    );
    // make user admin
    app.patch(
      "/users/makeAdmin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const userId = req.params.id;
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { role: "admin" } }
        );
        res.send(result);
      }
    );
    // get user for admin
    app.get("/alluser-admin", verifyToken, verifyAdmin, async (req, res) => {
      const searchQuery = req.query.search || "";
      const query = {
        $or: [
          { name: { $regex: searchQuery, $options: "i" } },
          { email: { $regex: searchQuery, $options: "i" } },
        ],
      };
      const page = parseInt(req.query.page);
      const limit = parseInt(req.query.limit);
      const skip = page * limit;
      const result = await usersCollection
        .find(query)
        .skip(skip)
        .limit(limit)
        .toArray();
      res.send(result);
    });

    // get all user count for admin pagination
    app.get(
      "/alluser-admin-count",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const result = await usersCollection.countDocuments();
        res.send({ result });
      }
    );

    // api for login or register user
    app.post("/users", verifyToken, async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already existis", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // add class by teacher verfication after verifyToken
    app.post("/addClass", verifyToken, verifyTeacher, async (req, res) => {
      const body = req.body;
      const result = await AllClassesCollection.insertOne(body);
      res.send(result);
    });

    // find added class by teacher
    app.get(
      "/findClass/:email",
      verifyToken,
      verifyTeacher,
      async (req, res) => {
        const email = req.params.email;
        const query = { email: email };
        const result = await AllClassesCollection.find(query).toArray();
        res.send(result);
      }
    );

    // api for teacher request
    app.get("/teacherReq/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const existingUser = await teachersCollection.findOne(query);
      if (!existingUser) {
        return res.send(false);
      }
      const result = existingUser.status;
      res.send(result);
    });

    // api for teacher request approved or reject
    app.patch(
      "/class-request/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const message = req.query.message;
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        if (message === "approved") {
          const update = {
            $set: {
              status: "approved",
            },
          };
          const findEmail = await teachersCollection.findOne(query);
          const email = { email: findEmail.email };
          const updateUserStatus = {
            $set: {
              role: "teacher",
            },
          };
          const userUpdate = await usersCollection.updateOne(
            email,
            updateUserStatus
          );
          const result = await teachersCollection.updateOne(query, update);
          return res.send(result);
        } else {
          const update = {
            $set: {
              status: "reject",
            },
          };
          const result = await teachersCollection.updateOne(query, update);
          return res.send(result);
        }
      }
    );

    // delete the class from teacher or admin side
    app.delete("/delete-class/:id", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const find = await usersCollection.findOne(query);
      const status = find.role;
      if (status === "teacher" || status === "admin") {
        const id = req.params.id;
        const deleteQuery = { _id: new ObjectId(id) };
        const result = await AllClassesCollection.deleteOne(deleteQuery);
        res.send(result);
      } else {
        res.status(403).send({ message: "unauthorized access" });
      }
    });

    // =========================  public api ===================================

    // user profile
    app.get("/user/profile/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    app.get("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await AllClassesCollection.findOne(query);
      res.send(result);
    });
    app.patch("/classenroll-update/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const email = req.query.email;
      const name = req.query.name;
      const enrollInfo = {
        name: name,
        email: email,
        class: id,
      };
      const enroll = await enrollCollection.insertOne(enrollInfo);
      const query = { _id: new ObjectId(id) };
      const find = await AllClassesCollection.findOne(query);
      const updateEnroll = parseInt(find.enroll) + 1;
      const update = {
        $set: {
          enroll: updateEnroll,
        },
      };
      const result = await AllClassesCollection.updateOne(query, update);
      res.send(result);
    });

    // find the enroll classes
    app.get("/Enrollclasses/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const enrollments = await enrollCollection.find(query).toArray();

      // fetch the classes
      const enrolledClasses = await Promise.all(
        enrollments.map(async (enrollment) => {
          const classId = enrollment.class;
          const id = { _id: new ObjectId(classId) };
          const classDetails = await AllClassesCollection.findOne(id);
          return classDetails;
        })
      );
      res.send(enrolledClasses);
    });
    // public api for top enroll section
    app.get("/classes", async (req, res) => {
      const result = await AllClassesCollection.find()
        .sort({ enroll: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.get("/allclasses", async (req, res) => {
      const limit = parseInt(req.query.limit);
      const page = parseInt(req.query.page);
      const skip = page * limit;
      const status = { status: "approved" };
      const result = await AllClassesCollection.find(status)
        .skip(skip)
        .limit(limit)
        .toArray();
      res.send(result);
    });
    // stripe api
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.get("/feedback", async (req, res) => {
      const result = await feedbackCollection.find().toArray();
      res.send(result);
    });
    // api for teacher related
    app.post("/teacher", verifyToken, async (req, res) => {
      const body = req.body;
      const result = await teachersCollection.insertOne(body);
      res.send();
    });

    // total user, classes, enrollment count
    app.get("/totalCount", async (req, res) => {
      const query = { status: "approved" };
      const allClasses = await AllClassesCollection.countDocuments(query);
      const alluser = await usersCollection.estimatedDocumentCount();
      const totalEnroll = await AllClassesCollection.aggregate([
        {
          $group: {
            _id: null,
            totalenroll: { $sum: "$enroll" },
          },
        },
      ]).toArray();
      const total = totalEnroll[0]?.totalenroll || 0;

      res.send({ allClasses, alluser, totalEnroll: total });
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
