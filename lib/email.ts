import nodemailer from "nodemailer";

export async function sendMagicLinkEmail(to: string, link: string) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM;

  if (!host || !user || !pass || !from) {
    throw new Error("Missing SMTP config: SMTP_HOST/SMTP_USER/SMTP_PASS/EMAIL_FROM");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  await transporter.sendMail({
    from,
    to,
    subject: "Your Course Map Wizard sign-in link",
    text: `Use this link to sign in:\n\n${link}\n\nIf you didn’t request this, ignore this email.`
  });
}
