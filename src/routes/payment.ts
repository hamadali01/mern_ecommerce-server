import express from "express";
import { adminOnly } from "../middlewares/auth.js";
import {
  applyDiscount,
  createCoupon,
  createPaymentIntent,
  deleteCoupon,
  getAllCoupons,
} from "../controllers/payment.js";

const app = express.Router();

app.post('/create', createPaymentIntent)
app.get("/discount", applyDiscount);
app.post("/coupon/new", adminOnly, createCoupon);
app.get("/coupon/all", adminOnly, getAllCoupons);
app.delete("/coupon/:id", adminOnly, deleteCoupon);

export default app;
