import { Request, Response } from "express";
import PDFDocument from "pdfkit";
import Stripe from "stripe";
import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import { env } from "../../config/env";
import { AppError } from "../../utils/errors";

export const createCheckout = async (req: Request, res: Response) => {
  if (!stripe) throw new AppError(503, "Payments are not configured");

  const a = await prisma.appointment.findUnique({
    where: { id: String(req.params.appointmentId) },
    include: { patient: true, doctor: true },
  });
  if (!a || a.patient.userId !== req.user!.id) throw new AppError(404, "Appointment not found");
  if (a.paymentStatus === "PAID") throw new AppError(409, "Already paid");
  if (a.status === "CANCELLED") throw new AppError(409, "Appointment is cancelled");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: env.PAYMENT_CURRENCY,
          unit_amount: Math.round(a.amount * 100),
          product_data: { name: `Consultation - ${a.doctor.fullName} (${a.doctor.specialty})` },
        },
      },
    ],
    client_reference_id: a.id,
    metadata: { appointmentId: a.id },
    success_url: `${env.FRONTEND_URL}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.FRONTEND_URL}/payments/cancel`,
  });

  await prisma.appointment.update({ where: { id: a.id }, data: { stripeSessionId: session.id } });
  res.json({ success: true, data: { url: session.url } });
};

// Raw body lagbe, tai app.ts-e express.json()-er age mount kora
export const stripeWebhook = async (req: Request, res: Response) => {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) throw new AppError(503, "Payments are not configured");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"] as string,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return res.status(400).send("Invalid signature");
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    const id = s.metadata?.appointmentId;
    if (id && s.payment_status === "paid") {
      // idempotent: duibar webhook ashle o kono somoshya nai
      await prisma.appointment.updateMany({
        where: { id, paymentStatus: { not: "PAID" } },
        data: { paymentStatus: "PAID" },
      });
    }
  }
  res.json({ received: true });
};

export const invoicePdf = async (req: Request, res: Response) => {
  const a = await prisma.appointment.findUnique({
    where: { id: String(req.params.appointmentId) },
    include: { patient: true, doctor: true },
  });
  if (!a) throw new AppError(404, "Appointment not found");

  const user = req.user!;
  const allowed =
    user.role === "ADMIN" ||
    (user.role === "PATIENT" && a.patient.userId === user.id) ||
    (user.role === "DOCTOR" && a.doctor.userId === user.id);
  if (!allowed) throw new AppError(403, "No access");

  const doc = new PDFDocument({ margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="invoice-${a.id}.pdf"`);
  doc.pipe(res);

  doc.fontSize(22).text("CarePulse - Invoice");
  doc.moveDown();
  doc.fontSize(11);
  doc.text(`Invoice ID: ${a.id}`);
  doc.text(`Patient: ${a.patient.firstName} ${a.patient.lastName}`);
  doc.text(`Doctor: ${a.doctor.fullName} (${a.doctor.specialty})`);
  doc.text(`Appointment: ${a.scheduledAt.toISOString()}`);
  doc.text(`Status: ${a.status}`);
  doc.moveDown();
  doc.fontSize(14).text(`Amount: ${a.amount.toFixed(2)} ${env.PAYMENT_CURRENCY.toUpperCase()}`);
  doc.fontSize(11).text(`Payment status: ${a.paymentStatus}`);
  doc.moveDown();
  doc.text("Insurance claim reference: ______________________");
  doc.end();
};