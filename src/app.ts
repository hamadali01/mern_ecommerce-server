import { config } from "dotenv";
import express from "express";
import morgan from "morgan";
import NodeCache from "node-cache";
import { errorMiddleware } from "./middlewares/error.js";
import { connectDB } from "./utils/features.js";
import Stripe from "stripe";
import cors from 'cors'

// Importing Routes
import orderRoute from "./routes/order.js";
import paymentRoute from "./routes/payment.js";
import productRoute from "./routes/product.js";
import dashboardRoute from "./routes/stats.js";
import userRoute from "./routes/user.js";

config({
  path: `./.env`,
  encoding: "utf-8",
  debug: true,
});
const port = process.env.PORT || 4000;

const mongoUri = process.env.MOONGO_URI || "";
const stripeKey = process.env.STRIPE_KEY || "";

connectDB(mongoUri);

export const nodeCache = new NodeCache();

export const stripe = new Stripe(stripeKey);
const app = express();

app.use(express.json());
app.use(morgan("dev"));
app.use(cors());

app.get("/", (req, res) => {
  res.send("API Working with /api/v1");
});

// Using Routes
app.use("/api/v1/users", userRoute);
app.use("/api/v1/products", productRoute);
app.use("/api/v1/orders", orderRoute);
app.use("/api/v1/payments", paymentRoute);
app.use("/api/v1/dashboard", dashboardRoute);

app.use("/uploads", express.static("uploads"));
app.use(errorMiddleware);

app.listen(port, () => console.log(`Server listening on ${port}`));
