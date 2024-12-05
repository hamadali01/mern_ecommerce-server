import { Request } from "express";
import { nodeCache } from "../app.js";
import { TryCatch } from "../middlewares/error.js";
import { Order } from "../models/order.js";
import { NewOrderRequestBody } from "../types/types.js";
import { invalidateCache, reduceStocks } from "../utils/features.js";
import ErrorHandler from "../utils/utility-class.js";

export const newOrder = TryCatch(
  async (req: Request<{}, {}, NewOrderRequestBody>, res, next) => {
    const {
      shippingInfo,
      orderItems,
      user,
      tax,
      discount,
      shippingCharges,
      subtotal,
      totalAmount,
    } = req.body;

    if (!shippingInfo || !orderItems || !user || !subtotal || !totalAmount)
      return next(new ErrorHandler("Please Enter All Fields", 400));
    await Order.create({
      shippingInfo,
      orderItems,
      user,
      tax,
      discount,
      shippingCharges,
      subtotal,
      totalAmount,
    });

    await reduceStocks(orderItems);
    invalidateCache({
      product: true,
      order: true,
      admin: true,
      userId: user,
      productId: orderItems.map((i) => String(i.productId)),
    });

    return res.status(201).json({
      success: true,
      message: "Order Placed Successfully",
    });
  }
);

export const myOrders = TryCatch(async (req, res, next) => {
  const { id: user } = req.query;
  let orders = [];

  const cacheKey = `my-orders-${user}`;

  if (nodeCache.has(cacheKey)) orders = JSON.parse(nodeCache.get(cacheKey)!);
  else {
    orders = await Order.find({ user });
    nodeCache.set(cacheKey, JSON.stringify(orders));
  }
  return res.status(200).json({
    success: true,
    orders,
  });
});

export const allOrders = TryCatch(async (req, res, next) => {
  let orders = [];

  const cacheKey = `all-orders`;

  if (nodeCache.has(cacheKey)) orders = JSON.parse(nodeCache.get(cacheKey)!);
  else {
    orders = await Order.find().populate("user", "name");
    nodeCache.set(cacheKey, JSON.stringify(orders));
  }
  return res.status(200).json({
    success: true,
    orders,
  });
});

export const getSingleOrder = TryCatch(async (req, res, next) => {
  let order;
  const { id } = req.params;

  const cacheKey = `order-${id}`;

  if (nodeCache.has(cacheKey)) order = JSON.parse(nodeCache.get(cacheKey)!);
  else {
    order = await Order.findById(id).populate("user", "name");

    if (!order) return next(new ErrorHandler("Order Not Found", 404));

    nodeCache.set(cacheKey, JSON.stringify(order));
  }
  return res.status(200).json({
    success: true,
    order,
  });
});

export const processOrder = TryCatch(async (req, res, next) => {
  const { id } = req.params;

  const order = await Order.findById(id);

  if (!order) return next(new ErrorHandler("Order Not Found", 404));

  switch (order.status) {
    case "Processing":
      order.status = "Shipped";
      break;
    case "Shipped":
      order.status = "Delivered";
      break;

    default:
      order.status = "Delivered";
      break;
  }

  await order.save();

  invalidateCache({
    product: false,
    order: true,
    admin: true,
    userId: order.user,
    orderId: String(order._id),
  });

  return res.status(200).json({
    success: true,
    message: "Order Processed Successfully",
  });
});

export const deleteOrder = TryCatch(async (req, res, next) => {
  const { id } = req.params;

  const order = await Order.findById(id);

  if (!order) return next(new ErrorHandler("Order Not Found", 404));

  await order.deleteOne();

  invalidateCache({
    product: false,
    order: true,
    admin: true,
    userId: order.user,
    orderId: String(order._id),
  });

  return res.status(200).json({
    success: true,
    message: "Order Deleted Successfully",
  });
});
