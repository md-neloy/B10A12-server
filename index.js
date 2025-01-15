require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
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
      const result = await AllClassesCollection.find()
        .skip(skip)
        .limit(limit)
        .toArray();
      res.send(result);
    });

    app.get("/feedback", async (req, res) => {
      const result = await feedbackCollection.find().toArray();
      res.send(result);
    });
    // api for teacher related
    app.post("/teacher", async (req, res) => {
      const body = req.body;
      const result = await teachersCollection.insertOne(body);
      res.send();
    });
    // total user, classes, enrollment count
    app.get("/totalCount", async (req, res) => {
      const allClasses = await AllClassesCollection.estimatedDocumentCount();
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
