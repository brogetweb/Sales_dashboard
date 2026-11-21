import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import Admin from "./models/Admin.js";

const createAdmin = async () => {
  try {
    const username = (process.env.ADMIN_USERNAME || "admin").trim();
    const password = process.env.ADMIN_PASSWORD;

    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not configured");
    }

    if (!password) {
      throw new Error("ADMIN_PASSWORD is not configured");
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected");

    const existingAdmin = await Admin.findOne({ username });

    if (existingAdmin) {
      console.log(`Admin account "${username}" already exists`);
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await Admin.create({
      username,
      password: hashedPassword,
    });

    console.log(`Admin "${username}" created successfully`);

    process.exit(0);
  } catch (error) {
    console.error("Admin creation failed:", error.message);
    process.exit(1);
  }
};

createAdmin();
