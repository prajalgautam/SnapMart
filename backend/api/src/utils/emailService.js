import nodemailer from 'nodemailer'

const useSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS)

let transporter
if (useSmtp) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendEmail({ to, subject, text, html }) {
  if (!useSmtp) {
    console.log('EMAIL_NOT_CONFIGURED:', { to, subject, text, html })
    return
  }

  const from = process.env.EMAIL_FROM || `KOSHELI <${process.env.SMTP_USER}>`

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  })
}

export function emailIsConfigured() {
  return useSmtp
}
