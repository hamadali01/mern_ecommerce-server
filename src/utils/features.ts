import mongoose, { Document } from "mongoose";
import { nodeCache } from "../app.js";
import { Product } from "../models/product.js";
import { invalidateCacheProps, OrderItemType } from "../types/types.js";
import ErrorHandler from "./utility-class.js";

export const connectDB = (uri: string) => {
  mongoose
    .connect(uri, {
      dbName: "ECommerce24",
    })
    .then((c) =>
      console.log(`DB connected successfully on ${c.connection.host}`)
    )
    .catch((e) => console.log(e));
};

export const invalidateCache = ({
  product,
  order,
  admin,
  userId,
  orderId,
  productId,
}: invalidateCacheProps) => {
  if (product) {
    const productKeys: string[] = [
      "latestProducts",
      "categories",
      "adminProducts",
    ];
    if (typeof productId === "string") productKeys.push(`product-${productId}`);

    if (typeof productId === "object")
      productId.forEach((i) => productKeys.push(`product-${i}`));
    nodeCache.del(productKeys);
  }
  if (order) {
    const orderKeys: string[] = [
      "all-orders",
      `my-orders-${userId}`,
      `order-${orderId}`,
    ];
    nodeCache.del(orderKeys);
  }
  if (admin) {
    nodeCache.del(["admin-stats", "admin-pie-charts","admin-bar-charts", "admin-line-charts"])
  }
};

export const reduceStocks = async (orderItems: OrderItemType[]) => {
  for (let i = 0; i < orderItems.length; i++) {
    const order = orderItems[i];
    const product = await Product.findById(order.productId);
    if (!product) throw new ErrorHandler("Product not found", 404);
    product.stock -= order.quantity;
    await product.save();
  }
};

export const calculatePercentage = (thisMonth: number, lastMonth: number) => {
  if (lastMonth === 0) return thisMonth * 100;
  const percent = (thisMonth / lastMonth) * 100;
  return Number(percent.toFixed(0));
};

export const getInventories = async ({
  categories,
  productsCounts,
}: {
  categories: string[];
  productsCounts: number;
}) => {
  const categoriesCountPromise = categories.map((category) =>
    Product.countDocuments({ category })
  );

  const categoriesCount = await Promise.all(categoriesCountPromise);

  const categoryCount: Record<string, number>[] = [];

  categories.forEach((category, i) => {
    categoryCount.push({
      [category]: Math.round((categoriesCount[i] / productsCounts) * 100),
    });
  });

  return categoryCount;
};

interface MyDocument extends Document {
  createdAt: Date;
  discount?: number;
  totalAmount?: number;
}

type FuncProps = {
  length: number;
  docs: MyDocument[];
  today: Date;
  property?: "discount" | "totalAmount";
};

export const getChartData = ({ length, docs, today, property }: FuncProps) => {
  const data: number[] = new Array(length).fill(0);

  docs.forEach((i) => {
    const creationDate = i.createdAt;
    const monthDiff = (today.getMonth() - creationDate.getMonth() + 12) % 12;

    if (monthDiff < length) {
      data[length - monthDiff - 1] += property? i[property]! : 1;
    }
  });

  return data;
};
