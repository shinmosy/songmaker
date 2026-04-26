import * as nodemailer from 'nodemailer';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email, verificationCode } = await request.json();

    if (!email || !verificationCode) {
      return NextResponse.json(
        { error: 'Email and verification code required' },
        { status: 400 }
      );
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify your SongMaker account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to SongMaker!</h2>
          <p>Your verification code is:</p>
          <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h1 style="margin: 0; letter-spacing: 5px; color: #000;">${verificationCode}</h1>
          </div>
          <p>This code will expire in 24 hours.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json(
      { success: true, message: 'Verification email sent' },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Email send error:', error);
    return NextResponse.json(
      { error: 'Failed to send verification email', detail: message },
      { status: 500 }
    );
  }
}
