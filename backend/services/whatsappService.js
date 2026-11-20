
import axios from "axios";

const sendWhatsAppReminder = async (customer) => {
  if (process.env.WHATSAPP_ENABLED !== "true") {
    return {
      success: false,
      skipped: true,
      message: "WhatsApp is disabled",
    };
  }

  const {
    WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_API_VERSION,
    WHATSAPP_ADMIN_NUMBER,
    WHATSAPP_TEMPLATE_NAME,
    WHATSAPP_TEMPLATE_LANGUAGE,
  } = process.env;

  if (
    !WHATSAPP_ACCESS_TOKEN ||
    !WHATSAPP_PHONE_NUMBER_ID ||
    !WHATSAPP_ADMIN_NUMBER
  ) {
    throw new Error("WhatsApp configuration is incomplete");
  }

  const latestFeedback =
    customer.feedbackHistory[
      customer.feedbackHistory.length - 1
    ];

  const followUpDate = new Date(
    customer.followUpAt
  ).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  const url =
    `https://graph.facebook.com/` +
    `${WHATSAPP_API_VERSION}/` +
    `${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: WHATSAPP_ADMIN_NUMBER.replace(/\D/g, ""),
    type: "template",
    template: {
      name: WHATSAPP_TEMPLATE_NAME,
      language: {
        code: WHATSAPP_TEMPLATE_LANGUAGE || "en",
      },
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: customer.name || "Customer",
            },
            {
              type: "text",
              text: customer.mobile,
            },
            {
              type: "text",
              text: followUpDate,
            },
            {
              type: "text",
              text: latestFeedback?.remark || "No remark",
            },
          ],
        },
      ],
    },
  };

  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  return {
    success: true,
    messageId: response.data.messages?.[0]?.id,
  };
};

export default sendWhatsAppReminder;
