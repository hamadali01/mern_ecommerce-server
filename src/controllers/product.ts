import { Request } from "express";
import { TryCatch } from "../middlewares/error.js";
import {
  BaseQuery,
  NewProductRequestBody,
  SearchRequestQuery,
} from "../types/types.js";
import { Product } from "../models/product.js";
import ErrorHandler from "../utils/utility-class.js";
import { rm } from "fs";
import { nodeCache } from "../app.js";
import { invalidateCache } from "../utils/features.js";
// import {faker} from '@faker-js/faker'

export const newProduct = TryCatch(
  async (req: Request<{}, {}, NewProductRequestBody>, res, next) => {
    const { name, category, price, stock } = req.body;
    const photo = req.file;

    if (!photo) return next(new ErrorHandler("Please upload a photo", 400));
    if (!name || !category || !price || !stock) {
      rm(photo.path, () => {
        console.log("Deleted photo file: ", photo.path);
      });
      return next(new ErrorHandler("Please fill all fields", 400));
    }

    await Product.create({
      name,
      category: category.toLocaleLowerCase(),
      price,
      stock,
      photo: photo.path,
    });

    invalidateCache({ product: true, admin: true });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
    });
  }
);

export const getLatestProducts = TryCatch(async (req, res, next) => {
  let products = [];
  if (nodeCache.has("latestProducts"))
    products = JSON.parse(nodeCache.get("latestProducts")!);
  else {
    products = await Product.find().sort({ createdAt: -1 }).limit(5);
    nodeCache.set("latestProducts", JSON.stringify(products));
  }
  return res.status(200).json({
    success: true,
    products,
  });
});

export const getAllCategories = TryCatch(async (req, res, next) => {
  let categories;
  if (nodeCache.has("categories"))
    categories = JSON.parse(nodeCache.get("categories")!);
  else {
    categories = await Product.distinct("category");
    nodeCache.set("categories", JSON.stringify(categories));
  }
  return res.status(200).json({
    success: true,
    categories,
  });
});

export const getAdminProducts = TryCatch(async (req, res, next) => {
  let products;
  if (nodeCache.has("adminProducts"))
    products = JSON.parse(nodeCache.get("adminProducts")!);
  else {
    products = await Product.find();
    nodeCache.set("adminProducts", JSON.stringify(products));
  }
  return res.status(200).json({
    success: true,
    products,
  });
});

export const getSingleProduct = TryCatch(async (req, res, next) => {
  let product;
  const id = req.params.id;
  if (nodeCache.has(`product-${id}`))
    product = JSON.parse(nodeCache.get(`product-${id}`)!);
  else {
    product = await Product.findById(id);
    if (!product) return next(new ErrorHandler("Product not found", 404));
    nodeCache.set(`product-${id}`, JSON.stringify(product));
  }
  return res.status(200).json({
    success: true,
    product,
  });
});

export const updateProduct = TryCatch(async (req, res, next) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) return next(new ErrorHandler("Product not found", 404));

  const { name, category, price, stock } = req.body;
  const photo = req.file;

  if (photo) {
    rm(product.photo, () => {
      console.log("Deleted old photo");
    });
    product.photo = photo.path;
  }

  if (name) product.name = name;
  if (category) product.category = category.toLocaleLowerCase();
  if (price) product.price = price;
  if (stock) product.stock = stock;

  await product.save();

  invalidateCache({
    admin: true,
    product: true,
    productId: String(product._id),
  });

  return res.status(200).json({
    success: true,
    message: "Product updated successfully",
  });
});

export const deleteProduct = TryCatch(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return next(new ErrorHandler("Product not found", 404));

  rm(product.photo, () => {
    console.log("Deleted photo file");
  });
  await product.deleteOne();

  invalidateCache({
    product: true,
    productId: String(product._id),
    admin: true,
  });
  return res.status(200).json({
    success: true,
    message: "Product Deleted Successfully",
  });
});

export const getAllProducts = TryCatch(
  async (req: Request<{}, {}, {}, SearchRequestQuery>, res, next) => {
    const { category, search, price, sort } = req.query;
    const page = Number(req.query.page) || 1;
    const limit = Number(process.env.PRODUCT_PER_PAGE) || 8;
    const skip = (page - 1) * limit;
    const baseQuery: BaseQuery = {};
    if (category) baseQuery.category = category.toLocaleLowerCase();
    if (search) baseQuery.name = { $regex: search, $options: "i" };
    if (price) baseQuery.price = { $lte: Number(price) };

    const [products, totalCount] = await Promise.all([
      Product.find(baseQuery)
        .sort(sort && { price: sort === "asc" ? 1 : -1 })
        .limit(limit)
        .skip(skip),
      Product.countDocuments(baseQuery),
    ]);
    const pageCount = Math.ceil(totalCount / limit);
    return res.status(200).json({
      success: true,
      products,
      totalPages: pageCount,
    });
  }
);

// const generateRandomProducts = async (count: number = 10) => {
//     const products = [];

//     for (let i = 0; i < count; i++) {
//         const product = {
//             name: faker.commerce.productName(),
//             category: faker.commerce.department(),
//             price: faker.commerce.price({ min: 1500, max: 50000, dec: 0 }),
//             stock: faker.commerce.price({ min: 0, max: 100, dec: 0 }),
//             photo: "uploads\\8e2a42db-b274-4568-9657-9d3c8aa85bad.jpg",
//             createdAt: new Date(faker.date.past()),
//             updatedAt: new Date(faker.date.recent()),
//         };
//         products.push(product);
//     }

//     await Product.create(products);
//     console.log("Generated random products successfully.");
// }

// const deleteProducts = async (count: number = 10) => {
//     const products = await Product.find({}).skip(2);

//     for (let product of products) {
//         await product.deleteOne();
//         console.log(`Deleted product: ${product.name}`);
//     }
// }

// deleteProducts(38)

// generateRandomProducts(40)
