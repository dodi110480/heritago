import nodemailer from 'nodemailer';

type MailOptions = {
    to: string;
    subject: string;
    text: string;
    html?: string;
};

/**
 * Transactional email service. Reads SMTP settings from environment variables.
 * Falls back to console logging when no SMTP host is configured (dev/test).
 */
export class MailService {
    private transporter: any = null;
    private from: string;

    constructor() {
        this.from = process.env.MAIL_FROM || 'Heritago <no-reply@heritago.local>';
        const host = process.env.MAIL_HOST;
        if (host) {
            const port = Number(process.env.MAIL_PORT || 587);
            const user = process.env.MAIL_USER;
            const pass = process.env.MAIL_PASS;
            this.transporter = nodemailer.createTransport({
                host,
                port,
                secure: port === 465,
                auth: user && pass ? { user, pass } : undefined
            });
        }
    }

    async sendMail(opts: MailOptions): Promise<void> {
        if (this.transporter) {
            await this.transporter.sendMail({ from: this.from, ...opts });
            return;
        }
        // No SMTP configured: log the mail instead of failing (dev/test).
        console.log(`[MailService] (no SMTP) To: ${opts.to} | Subject: ${opts.subject}\n${opts.text}`);
    }
}
