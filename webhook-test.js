#!/usr/bin/env node

/**
 * Paystack Webhook Test Helper
 * 
 * This script helps you:
 * 1. Generate valid webhook signatures
 * 2. Test webhook events locally
 * 3. Simulate different payment scenarios
 * 
 * Usage:
 *   node webhook-test.js [command]
 * 
 * Commands:
 *   - test-online      Test online payment webhook
 *   - test-dva         Test DVA (bank transfer) webhook
 *   - test-dva-assign  Test DVA assignment webhook
 *   - sign <json>      Generate signature for custom payload
 */

import crypto from "crypto";
import fetch from "node-fetch";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const WEBHOOK_URL = process.env.WEBHOOK_TEST_URL || "http://localhost:5000/api/wallet/webhook";

if (!PAYSTACK_SECRET) {
  console.error("❌ PAYSTACK_SECRET_KEY environment variable not set!");
  process.exit(1);
}

function generateSignature(body) {
  const bodyString = typeof body === "string" ? body : JSON.stringify(body);
  return crypto
    .createHmac("sha512", PAYSTACK_SECRET)
    .update(bodyString)
    .digest("hex");
}

async function sendWebhook(event) {
  const body = JSON.stringify(event);
  const signature = generateSignature(body);

  console.log("\n📤 Sending webhook...");
  console.log("URL:", WEBHOOK_URL);
  console.log("Event:", event.event);
  console.log("Signature:", signature);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-paystack-signature": signature,
      },
      body: body,
    });

    console.log("✅ Response Status:", response.status);
    const responseText = await response.text();
    if (responseText) {
      console.log("Response Body:", responseText);
    }
  } catch (error) {
    console.error("❌ Error sending webhook:", error.message);
  }
}

// Test: Online payment successful
async function testOnlinePayment() {
  console.log("\n🧪 Test 1: Online Payment (charge.success)");
  console.log("═".repeat(50));

  const event = {
    event: "charge.success",
    data: {
      id: 1234567890,
      reference: "WF-" + Date.now(),
      amount: 100000, // ₦1000 in kobo
      currency: "NGN",
      status: "success",
      paid_at: new Date().toISOString(),
      gateway_response: "Approved by User",
      channel: "card",
      customer: {
        id: 123,
        email: "test@example.com",
        customer_code: "CUS_xyz123",
        first_name: "Test",
        last_name: "User",
      },
      metadata: {
        custom_fields: [],
      },
    },
  };

  console.log("Event data:", JSON.stringify(event.data, null, 2));
  await sendWebhook(event);
}

// Test: DVA account assigned
async function testDVAAssignment() {
  console.log("\n🧪 Test 2: DVA Assignment (dedicatedaccount.assign.success)");
  console.log("═".repeat(50));

  const event = {
    event: "dedicatedaccount.assign.success",
    data: {
      id: 9876543210,
      dedicated_account: {
        bank: {
          id: 9,
          name: "Wema Bank",
          slug: "wema-bank",
          code: "035",
        },
        account_number: "9755046603",
        account_name: "JOHN DOE",
        currency: "NGN",
        metadata: null,
        active: true,
        created_at: new Date().toISOString(),
        assignment: {
          assignee_id: 456,
          assigned_at: new Date().toISOString(),
        },
      },
      customer: {
        id: 123,
        first_name: "John",
        last_name: "Doe",
        email: "john@example.com",
        customer_code: "CUS_xyz123",
        phone: "+2348012345678",
        risk_action: "default",
      },
    },
  };

  console.log("Event data:", JSON.stringify(event.data, null, 2));
  await sendWebhook(event);
}

// Test: DVA payment received
async function testDVAPayment() {
  console.log("\n🧪 Test 3: DVA Payment (charge.success - bank transfer)");
  console.log("═".repeat(50));

  const event = {
    event: "charge.success",
    data: {
      id: 5432109876,
      reference: "DVA-" + Date.now(),
      amount: 500000, // ₦5000 in kobo
      currency: "NGN",
      status: "success",
      paid_at: new Date().toISOString(),
      gateway_response: "Approved",
      channel: "dedicated_nuban",
      account_number: "9755046603",
      customer: {
        id: 123,
        email: "john@example.com",
        customer_code: "CUS_xyz123",
        first_name: "John",
        last_name: "Doe",
      },
      metadata: {
        sender_bank: "GTBank",
        sender_account: "1234567890",
        sender_name: "JANE SMITH",
      },
    },
  };

  console.log("Event data:", JSON.stringify(event.data, null, 2));
  await sendWebhook(event);
}

// Test: Failed payment
async function testFailedPayment() {
  console.log("\n🧪 Test 4: Failed Payment (charge.failed)");
  console.log("═".repeat(50));

  const event = {
    event: "charge.failed",
    data: {
      id: 9999999999,
      reference: "WF-" + Date.now(),
      amount: 100000,
      currency: "NGN",
      status: "failed",
      gateway_response: "Declined",
      channel: "card",
      customer: {
        id: 123,
        email: "test@example.com",
        customer_code: "CUS_xyz123",
      },
    },
  };

  console.log("Event data:", JSON.stringify(event.data, null, 2));
  await sendWebhook(event);
}

// Main CLI
async function main() {
  const command = process.argv[2] || "help";

  switch (command) {
    case "test-online":
      await testOnlinePayment();
      break;
    case "test-dva":
      await testDVAPayment();
      break;
    case "test-dva-assign":
      await testDVAAssignment();
      break;
    case "test-failed":
      await testFailedPayment();
      break;
    case "test-all":
      await testDVAAssignment();
      await new Promise((r) => setTimeout(r, 1000));
      await testOnlinePayment();
      await new Promise((r) => setTimeout(r, 1000));
      await testDVAPayment();
      break;
    case "sign":
      if (!process.argv[3]) {
        console.error("❌ Please provide JSON payload: node webhook-test.js sign '{...}'");
        process.exit(1);
      }
      try {
        const payload = JSON.parse(process.argv[3]);
        const signature = generateSignature(payload);
        console.log("✅ Signature generated:");
        console.log("Signature:", signature);
        console.log("\nUse this in x-paystack-signature header");
      } catch (error) {
        console.error("❌ Invalid JSON:", error.message);
      }
      break;
    case "help":
    default:
      console.log(`
📋 Paystack Webhook Test Helper

Usage:
  node webhook-test.js [command]

Commands:
  test-online    - Test online payment (card/bank)
  test-dva       - Test DVA bank transfer payment
  test-dva-assign - Test DVA account assignment
  test-failed    - Test failed payment
  test-all       - Run all tests sequentially
  sign <json>    - Generate signature for custom payload
  help           - Show this help message

Environment Variables:
  PAYSTACK_SECRET_KEY   - Your Paystack secret key (required)
  WEBHOOK_TEST_URL      - Webhook URL (default: http://localhost:5000/api/wallet/webhook)

Examples:
  # Test online payment
  PAYSTACK_SECRET_KEY=sk_test_xxx node webhook-test.js test-online
  
  # Test all webhooks
  PAYSTACK_SECRET_KEY=sk_test_xxx node webhook-test.js test-all
  
  # Sign custom payload
  node webhook-test.js sign '{"event":"charge.success","data":{"reference":"xyz123"}}'
      `);
  }
}

main().catch(console.error);
