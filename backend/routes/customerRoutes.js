
import express from "express";
import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

// ---------------- VALIDATIONS ----------------

const validMobile = (mobile) =>
  /^[6-9]\d{9}$/.test(String(mobile || "").trim());

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const rejectInvalidId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      message: "Invalid customer ID",
    });
  }

  next();
};

const validateCustomer = (body) => {
  if (!body.mobile || !validMobile(body.mobile)) {
    return "Enter a valid 10-digit Indian mobile number";
  }

  if (!body.remark?.trim()) {
    return "Customer remark is required";
  }

  if (
    body.followUpAt &&
    Number.isNaN(new Date(body.followUpAt).getTime())
  ) {
    return "Invalid follow-up date";
  }

  return null;
};

// ---------------- CUSTOMER STATS ----------------

router.get("/stats", async (req, res) => {
  try {
    const customers = await Customer.find();

    const now = new Date();

    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);

    const endToday = new Date(now);
    endToday.setHours(23, 59, 59, 999);

    const active = customers.filter(
      (c) =>
        !c.followUpDone &&
        !["Converted", "Not Interested"].includes(c.status) &&
        c.followUpAt
    );

    const today = active.filter(
      (c) =>
        c.followUpAt >= startToday &&
        c.followUpAt <= endToday
    ).length;

    const overdue = active.filter(
      (c) => c.followUpAt < startToday
    ).length;

    const upcoming = active.filter(
      (c) => c.followUpAt > endToday
    ).length;

    const reasons = {};

    customers.forEach((customer) => {
      customer.feedbackHistory.forEach((feedback) => {
        reasons[feedback.remark] =
          (reasons[feedback.remark] || 0) + 1;
      });
    });

    res.json({
      totalCustomers: customers.length,
      today,
      overdue,
      upcoming,
      converted: customers.filter(
        (c) => c.status === "Converted"
      ).length,
      reasons,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// ---------------- GET ALL CUSTOMERS ----------------

router.get("/", async (req, res) => {
  try {
    const {
      search = "",
      status = "",
      reason = "",
      followUp = "",
    } = req.query;

    const filter = {};

    if (search) {
      const pattern = escapeRegex(String(search).trim());

      filter.$or = [
        { mobile: { $regex: pattern, $options: "i" } },
        { name: { $regex: pattern, $options: "i" } },
        { propertyName: { $regex: pattern, $options: "i" } },
      ];
    }

    if (status) {
      filter.status = status;
    }

    if (reason) {
      filter["feedbackHistory.remark"] = reason;
    }

    if (followUp === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const end = new Date();
      end.setHours(23, 59, 59, 999);

      filter.followUpAt = {
        $gte: start,
        $lte: end,
      };

      filter.followUpDone = false;
    }

    if (followUp === "overdue") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      filter.followUpAt = {
        $lt: start,
      };

      filter.followUpDone = false;
    }

    if (followUp === "upcoming") {
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      filter.followUpAt = {
        $gt: end,
      };

      filter.followUpDone = false;
    }

    const customers = await Customer.find(filter)
      .sort({ updatedAt: -1 });

    res.json(customers);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// ---------------- ADD CUSTOMER / ADD FEEDBACK ----------------

router.post("/", async (req, res) => {
  try {
    const {
      name,
      mobile,
      propertyName,
      remark,
      otherRemark,
      feedbackDate,
      followUpAt,
      status,
    } = req.body;

    const validationError = validateCustomer({
      mobile,
      remark,
      followUpAt,
    });

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const normalizedMobile = String(mobile).trim();

    let customer = await Customer.findOne({
      mobile: normalizedMobile,
    });

    const feedback = {
      remark: remark.trim(),
      otherRemark: otherRemark || "",
      feedbackDate: feedbackDate || new Date(),
    };

    if (customer) {
      customer.name = name || customer.name;

      customer.propertyName =
        propertyName || customer.propertyName;

      customer.feedbackHistory.push(feedback);

      customer.status = status || "Follow-up";
      customer.followUpAt = followUpAt || null;
      customer.followUpDone = false;

      customer.reminderSentAt = null;
      customer.reminderLastAttemptAt = null;
      customer.reminderError = "";

      await customer.save();
    } else {
      customer = await Customer.create({
        name,
        mobile: normalizedMobile,
        propertyName,
        feedbackHistory: [feedback],
        status: status || "Follow-up",
        followUpAt: followUpAt || null,
      });
    }

    res.status(201).json({
      message: "Customer saved successfully",
      customer,
    });
  } catch (error) {
    res.status(500).json({
      message:
        error.code === 11000
          ? "Mobile number already exists"
          : error.message,
    });
  }
});

// ---------------- UPDATE CUSTOMER ----------------

router.put("/:id", rejectInvalidId, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    const {
      name,
      mobile,
      propertyName,
      remark,
      otherRemark,
      feedbackDate,
      followUpAt,
      status,
      addFeedback,
    } = req.body;

    if (mobile && !validMobile(mobile)) {
      return res.status(400).json({
        message: "Invalid mobile number",
      });
    }

    if (mobile) {
      customer.mobile = String(mobile).trim();
    }

    if (name !== undefined) {
      customer.name = name;
    }

    if (propertyName !== undefined) {
      customer.propertyName = propertyName;
    }

    if (status) {
      customer.status = status;
    }

    if (followUpAt !== undefined) {
      const newDate = followUpAt || null;

      if (
        String(customer.followUpAt || "") !==
        String(newDate || "")
      ) {
        customer.followUpAt = newDate;
        customer.followUpDone = false;

        customer.reminderSentAt = null;
        customer.reminderLastAttemptAt = null;
        customer.reminderError = "";
      }
    }

    // Add a new feedback only when explicitly requested
    if (addFeedback && remark?.trim()) {
      customer.feedbackHistory.push({
        remark: remark.trim(),
        otherRemark: otherRemark || "",
        feedbackDate: feedbackDate || new Date(),
      });
    }

    await customer.save();

    res.json({
      message: "Customer updated successfully",
      customer,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Mobile number already exists",
      });
    }

    res.status(500).json({
      message: error.message,
    });
  }
});

// ---------------- EDIT EXISTING FEEDBACK ----------------

router.patch(
  "/:id/feedback/:feedbackId",
  rejectInvalidId,
  async (req, res) => {
    try {
      const { feedbackId } = req.params;

      if (!mongoose.isValidObjectId(feedbackId)) {
        return res.status(400).json({
          message: "Invalid feedback ID",
        });
      }

      const {
        remark,
        otherRemark,
        feedbackDate,
      } = req.body;

      if (!remark?.trim()) {
        return res.status(400).json({
          message: "Customer remark is required",
        });
      }

      if (
        feedbackDate !== undefined &&
        Number.isNaN(new Date(feedbackDate).getTime())
      ) {
        return res.status(400).json({
          message: "Invalid feedback date",
        });
      }

      const customer = await Customer.findById(req.params.id);

      if (!customer) {
        return res.status(404).json({
          message: "Customer not found",
        });
      }

      // Find the particular feedback using its subdocument ID
      const feedback = customer.feedbackHistory.id(feedbackId);

      if (!feedback) {
        return res.status(404).json({
          message: "Feedback not found",
        });
      }

      // Update existing feedback instead of pushing a new one
      feedback.remark = remark.trim();
      feedback.otherRemark = otherRemark || "";

      if (feedbackDate !== undefined) {
        feedback.feedbackDate = feedbackDate;
      }

      await customer.save();

      res.json({
        message: "Feedback updated successfully",
        customer,
      });
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  }
);

// ---------------- COMPLETE FOLLOW-UP ----------------

router.patch(
  "/:id/complete-followup",
  rejectInvalidId,
  async (req, res) => {
    try {
      const customer = await Customer.findById(req.params.id);

      if (!customer) {
        return res.status(404).json({
          message: "Customer not found",
        });
      }

      customer.followUpDone = true;
      customer.reminderError = "";

      await customer.save();

      res.json({
        message: "Follow-up completed",
        customer,
      });
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  }
);

// ---------------- DELETE CUSTOMER ----------------

router.delete("/:id", rejectInvalidId, async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(
      req.params.id
    );

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    res.json({
      message: "Customer deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

export default router;
