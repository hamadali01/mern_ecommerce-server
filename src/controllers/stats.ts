import { nodeCache } from "../app.js";
import { TryCatch } from "../middlewares/error.js";
import { Order } from "../models/order.js";
import { Product } from "../models/product.js";
import { User } from "../models/user.js";
import {
  calculatePercentage,
  getChartData,
  getInventories,
} from "../utils/features.js";

export const getDashboardStats = TryCatch(async (req, res, next) => {
  let stats;
  const key = "admin-stats";
  if (nodeCache.has(key)) stats = JSON.parse(nodeCache.get(key)!);
  else {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const thisMonth = {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: today,
    };

    const lastMonth = {
      start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
      end: new Date(today.getFullYear(), today.getMonth(), 0),
    };

    const thisMonthProductsPromise = Product.find({
      createdAt: { $gte: thisMonth.start, $lte: thisMonth.end },
    });
    const lastMonthProductsPromise = Product.find({
      createdAt: { $gte: lastMonth.start, $lte: lastMonth.end },
    });

    const thisMonthUsersPromise = User.find({
      createdAt: { $gte: thisMonth.start, $lte: thisMonth.end },
    });
    const lastMonthUsersPromise = User.find({
      createdAt: { $gte: lastMonth.start, $lte: lastMonth.end },
    });

    const thisMonthOrdersPromise = Order.find({
      createdAt: { $gte: thisMonth.start, $lte: thisMonth.end },
    });
    const lastMonthOrdersPromise = Order.find({
      createdAt: { $gte: lastMonth.start, $lte: lastMonth.end },
    });

    const lastSixMonthOrdersPromise = Order.find({
      createdAt: { $gte: sixMonthsAgo, $lte: today },
    });

    const latestTransactionsPromise = Order.find({})
      .select(["orderItems", "discount", "totalAmount", "status"])
      .limit(4);

    const [
      thisMonthProducts,
      thisMonthUsers,
      thisMonthOrders,
      lastMonthProducts,
      lastMonthUsers,
      lastMonthOrders,
      productsCounts,
      usersCounts,
      totalOrders,
      lastSixMonthOrders,
      categories,
      maleUsersCount,
      latestTransactions,
    ] = await Promise.all([
      thisMonthProductsPromise,
      thisMonthUsersPromise,
      thisMonthOrdersPromise,
      lastMonthProductsPromise,
      lastMonthUsersPromise,
      lastMonthOrdersPromise,
      Product.countDocuments(),
      User.countDocuments(),
      Order.find().select("totalAmount"),
      lastSixMonthOrdersPromise,
      Product.distinct("category"),
      User.countDocuments({ gender: "male" }),
      latestTransactionsPromise,
    ]);

    const thisMonthRevenue = thisMonthOrders.reduce(
      (totalAmount, order) => totalAmount + (order.totalAmount || 0),
      0
    );
    const lastMonthRevenue = lastMonthOrders.reduce(
      (totalAmount, order) => totalAmount + (order.totalAmount || 0),
      0
    );

    const revenuePercent = calculatePercentage(
      thisMonthRevenue,
      lastMonthRevenue
    );
    const productPercent = calculatePercentage(
      thisMonthProducts.length,
      lastMonthProducts.length
    );
    const userPercent = calculatePercentage(
      thisMonthUsers.length,
      lastMonthUsers.length
    );
    const orderPercent = calculatePercentage(
      thisMonthOrders.length,
      lastMonthOrders.length
    );

    const revenue = totalOrders.reduce(
      (totalAmount, order) => totalAmount + (order.totalAmount || 0),
      0
    );

    const percentages = {
      revenue: revenuePercent,
      products: productPercent,
      users: userPercent,
      orders: orderPercent,
    };

    const count = {
      products: productsCounts,
      users: usersCounts,
      orders: totalOrders.length,
      revenue,
    };

    const orderMonthCount = new Array(6).fill(0);
    const orderMonthlyRevenue = new Array(6).fill(0);

    lastSixMonthOrders.forEach((order) => {
      const creationDate = order.createdAt;
      const monthDiff = (today.getMonth() - creationDate.getMonth() + 12) % 12;

      if (monthDiff < 6) {
        orderMonthCount[6 - monthDiff - 1] += 1;
        orderMonthlyRevenue[6 - monthDiff - 1] += order.totalAmount;
      }
    });

    const categoryCount = await getInventories({ categories, productsCounts });
    const userRatio = {
      male: maleUsersCount,
      female: usersCounts - maleUsersCount,
    };

    const modifiedTransactions = latestTransactions.map((transaction) => ({
      _id: transaction._id,
      discount: transaction.discount,
      amount: transaction.totalAmount,
      quantity: transaction.orderItems.length,
      status: transaction.status,
    }));

    stats = {
      categoryCount: categoryCount,
      percentages,
      count,
      chart: {
        order: orderMonthCount,
        revenue: orderMonthlyRevenue,
      },
      userRatio,
      latestTransactions: modifiedTransactions,
    };

    nodeCache.set(key, JSON.stringify(stats));
  }

  return res.status(200).json({
    success: true,
    stats,
  });
});

export const getPieCharts = TryCatch(async (req, res, next) => {
  let charts;
  const key = "admin-pie-charts";
  if (nodeCache.has(key)) charts = JSON.parse(nodeCache.get(key)!);
  else {
    const allOrdersPromise = Order.find().select([
      "totalAmount",
      "tax",
      "shippingCharges",
      "discount",
      "subtotal",
    ]);
    const [
      processingOrder,
      shippedOrder,
      deliveredOrder,
      categories,
      productsCounts,
      outOfStockProducts,
      allOrders,
      allUsers,
      adminUsers,
      customerUsers,
    ] = await Promise.all([
      Order.countDocuments({ status: "Processing" }),
      Order.countDocuments({ status: "Shipped" }),
      Order.countDocuments({ status: "Delivered" }),
      Product.distinct("category"),
      Product.countDocuments(),
      Product.countDocuments({ stock: 0 }),
      allOrdersPromise,
      User.find().select(["dob"]),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "user" }),
    ]);

    const orderFullfillment = {
      processing: processingOrder,
      shipped: shippedOrder,
      delivered: deliveredOrder,
    };

    const productCategories = await getInventories({
      categories,
      productsCounts,
    });
    const stockAvailability = {
      inStock: productsCounts - outOfStockProducts,
      outOfStock: outOfStockProducts,
    };

    const grossIncome = allOrders.reduce(
      (prev, order) => prev + (order.totalAmount || 0),
      0
    );
    const discount = allOrders.reduce(
      (prev, order) => prev + (order.discount || 0),
      0
    );
    const productionCost = allOrders.reduce(
      (prev, order) => prev + (order.shippingCharges || 0),
      0
    );
    const burnt = allOrders.reduce((prev, order) => prev + (order.tax || 0), 0);
    const marketingCost = Math.round(grossIncome * (30 / 100));
    const netMargin =
      grossIncome - discount - productionCost - burnt - marketingCost;

    const revenueDistibution = {
      netMargin,
      discount,
      productionCost,
      burnt,
      marketingCost,
    };

    const usersAgeGroup = {
      teen: allUsers.filter((user) => user.age < 20).length,
      adult: allUsers.filter((user) => user.age >= 20 && user.age < 40).length,
      old: allUsers.filter((user) => user.age >= 40).length,
    };

    const adminCustomers = {
      admin: adminUsers,
      customer: customerUsers,
    };

    charts = {
      orderFullfillment,
      productCategories,
      stockAvailability,
      revenueDistibution,
      usersAgeGroup,
      adminCustomers,
    };

    nodeCache.set(key, JSON.stringify(charts));
  }
  return res.status(200).json({
    success: true,
    charts,
  });
});
export const getBarCharts = TryCatch(async (req, res, next) => {
  let charts;
  const key = "admin-bar-charts";
  if (nodeCache.has(key)) charts = JSON.parse(nodeCache.get(key)!);
  else {
    const today = new Date();

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const sixMonthProductsPromise = Product.find({
      createdAt: { $gte: sixMonthsAgo, $lte: today },
    }).select("createdAt");

    const sixMonthUsersPromise = User.find({
      createdAt: { $gte: sixMonthsAgo, $lte: today },
    }).select("createdAt");

    const twelveMonthOrdersPromise = Order.find({
      createdAt: { $gte: twelveMonthsAgo, $lte: today },
    }).select("createdAt");

    const [products, users, orders] = await Promise.all([
      sixMonthProductsPromise,
      sixMonthUsersPromise,
      twelveMonthOrdersPromise,
    ]);

    const productsCounts = getChartData({ length: 6, docs: products, today });
    const usersCounts = getChartData({ length: 6, docs: users, today });
    const ordersCounts = getChartData({ length: 12, docs: orders, today });

    charts = {
      users: usersCounts,
      products: productsCounts,
      orders: ordersCounts,
    };
    nodeCache.set(key, JSON.stringify(charts));
  }

  return res.status(200).json({
    success: true,
    charts,
  });
});
export const getLineCharts = TryCatch(async (req, res, next) => {
  let charts;
  const key = "admin-line-charts";
  if (nodeCache.has(key)) charts = JSON.parse(nodeCache.get(key)!);
  else {
    console.log("first line chart")
    const today = new Date();

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const baseQuery = {
      createdAt: { $gte: twelveMonthsAgo, $lte: today },
    };

    const [products, users, orders] = await Promise.all([
      Product.find(baseQuery).select("createdAt"),
      User.find(baseQuery).select("createdAt"),
      Order.find(baseQuery).select(["createdAt", "discount", "totalAmount"]),
    ]);

    const productsCounts = getChartData({ length: 12, docs: products, today });
    const usersCounts = getChartData({ length: 12, docs: users, today });
    const discount = getChartData({ length: 12, docs: orders, today, property: "discount" });
    const revenue = getChartData({ length: 12, docs: orders, today, property: "totalAmount" });

    charts = {
      users: usersCounts,
      products: productsCounts,
      discount,
      revenue,
    };
    nodeCache.set(key, JSON.stringify(charts));
  }
  return res.status(200).json({
    success: true,
    charts,
  });
});
