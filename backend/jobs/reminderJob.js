
import cron from "node-cron";
import Customer from "../models/Customer.js";
import sendWhatsAppReminder from "../services/whatsappService.js";

const startReminderJob = () => {
  cron.schedule(
    "* * * * *",
    async () => {
      try {
        const now = new Date();

        const retryBefore = new Date(
          now.getTime() - 15 * 60 * 1000
        );

        const customers = await Customer.find({
          followUpAt: { $lte: now },
          followUpDone: false,
          status: { $nin: ["Converted", "Not Interested"] },
          reminderSentAt: null,
          $or: [
            { reminderLastAttemptAt: null },
            { reminderLastAttemptAt: { $lte: retryBefore } },
          ],
        });

        for (const customer of customers) {
          customer.reminderLastAttemptAt = now;

          try {
            const result =
              await sendWhatsAppReminder(customer);

            if (result.success) {
              customer.reminderSentAt = new Date();
              customer.reminderError = "";
            }

            await customer.save();
          } catch (error) {
            customer.reminderError =
              error.response?.data?.error?.message ||
              error.message;

            await customer.save();

            console.error(
              "Reminder failed:",
              customer.mobile,
              customer.reminderError
            );
          }
        }
      } catch (error) {
        console.error(
          "Reminder scheduler error:",
          error.message
        );
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );

  console.log("Follow-up reminder scheduler started");
};

export default startReminderJob;
