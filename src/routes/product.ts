import express from "express";
import { adminOnly } from "../middlewares/auth.js";
import { deleteProduct, getAdminProducts, getAllCategories, getAllProducts, getLatestProducts, getSingleProduct, newProduct, updateProduct } from "../controllers/product.js";
import { uploadSingle } from "../middlewares/multer.js";

const app = express.Router();

app.post("/new", adminOnly, uploadSingle, newProduct);
app.get("/all", getAllProducts)
app.get("/latest", getLatestProducts);
app.get("/categories", getAllCategories);
app.get("/admin-products", adminOnly, getAdminProducts);

app.route("/:id").get(getSingleProduct).put(adminOnly, uploadSingle, updateProduct).delete(adminOnly, deleteProduct)

export default app;
