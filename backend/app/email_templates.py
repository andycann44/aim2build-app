def password_reset_subject() -> str:
    return "Reset your Aim2Build password"


def password_reset_text(reset_url: str) -> str:
    return (
        "You (or someone else) requested a password reset for Aim2Build.\n\n"
        f"Reset your password here:\n{reset_url}\n\n"
        "If you didn't request this, you can ignore this email.\n"
    )


def password_reset_html(reset_url: str) -> str:
    # Email-safe: tables + inline styles matching Aim2Build hero vibe.
    return f"""<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0b1120;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1120;">
      <tr>
        <td align="center" style="padding:0;">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:640px;">
            <tr>
              <td style="padding:0;">
                <!-- HERO BAR -->
                <div style="background:linear-gradient(135deg,#0b1120 0%,#1d4ed8 35%,#fbbf24 70%,#dc2626 100%);padding:22px 20px;border-radius:0 0 0 0;">
                  <div style="color:#ffffff;font-size:20px;font-weight:800;line-height:1.2;">
                    Aim2Build
                  </div>
                  <div style="color:#e5e7eb;font-size:14px;line-height:1.4;margin-top:6px;">
                    Reset your password
                  </div>
                </div>

                <!-- CARD -->
                <div style="background:#0f172a;border:1px solid #1f2937;border-top:0;padding:20px 18px;">
                  <div style="color:#e5e7eb;font-size:15px;line-height:1.6;">
                    You (or someone else) requested a password reset for your Aim2Build account.
                  </div>

                  <div style="height:16px;line-height:16px;">&nbsp;</div>

                  <!-- CTA BUTTON -->
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td bgcolor="#22c55e" style="border-radius:999px;">
                        <a href="{reset_url}"
                           style="display:inline-block;padding:12px 18px;color:#0b1120;text-decoration:none;font-weight:800;font-size:14px;letter-spacing:0.02em;">
                          Reset password
                        </a>
                      </td>
                    </tr>
                  </table>

                  <div style="height:14px;line-height:14px;">&nbsp;</div>

                  <div style="color:#94a3b8;font-size:12px;line-height:1.6;">
                    If the button doesn’t work, copy and paste this link:
                  </div>
                  <div style="color:#93c5fd;font-size:12px;line-height:1.6;word-break:break-all;">
                    {reset_url}
                  </div>

                  <div style="height:14px;line-height:14px;">&nbsp;</div>

                  <div style="color:#94a3b8;font-size:12px;line-height:1.6;">
                    If you didn’t request this, you can ignore this email.
                  </div>
                </div>

                <!-- FOOTER -->
                <div style="color:#64748b;font-size:11px;line-height:1.6;padding:12px 18px 18px 18px;text-align:left;">
                  Aim2Build • aim2build.co.uk
                </div>

              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""
