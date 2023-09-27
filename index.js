const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

/* Verify jwt */
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "UnAuthorization access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "UnAuthorization access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9a4nghi.mongodb.net/?retryWrites=true&w=majority`;

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
    // await client.connect();
    const hackathonCollection = client.db("warrior").collection("hackathons");
    const userCollection = client.db("warrior").collection("users");

    //jwt
    app.post("/jwt", (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    //verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    /* Verify mentor */
    const verifyMentor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "mentor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    //get admin for secure dashboard
    app.get("/users/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const email = req.params.email;
      if (email !== decodedEmail) {
        return res.send({ admin: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const admin = { admin: user?.role === "admin" };
      res.send(admin);
    });

    // get instructor for dashboard
    app.get(
      "/users/mentor/:email",
      verifyJWT,
      verifyMentor,
      async (req, res) => {
        const email = req.params.email;
        if (req.decoded.email !== email) {
          return res.send({ instructor: false });
        }
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const instructor = { instructor: user?.role === "mentor" };
        res.send(instructor);
      }
    );

    // Get Hackathons
    app.get("/hackathon", async (req, res) => {
      const title = req.query.title;
      const location = req.query.location;
      const category = req.query.category;
      console.log(title, location, category);
      if (location || category || title) {
        const result = await hackathonCollection
          .find({
            $or: [
              { title: { $regex: title, $options: "i" } },
              { location: location },
              { category: category },
            ],
          })
          .toArray();
        return res.send(result);
      }

      const result = await hackathonCollection.find().toArray();
      res.send(result);
    });

    // get with Id
    app.get("/hackathon/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await hackathonCollection.findOne(query);
      res.send(result);
    });

    /* Search hackathon */
    app.get("/hackathonSearch", async (req, res) => {
      const search = req.query.search;
      const query = { title: { $regex: search, $options: "i" } };
      const result = await hackathonCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/hachathon", async (req, res) => {
      const hachathon = req.body;
      hachathon.createdAt = new Date();
      const result = await hackathonCollection.insertOne(hachathon);
      res.send(result);
    });

    // user post
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "already exist" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // get User
    app.get("/user", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello Wolrd");
});
app.listen(port, () => {
  console.log(`server is running ${port}`);
});
