import "dotenv/config";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL is not set in environment or .env file");
    process.exit(1);
  }

  // Parse the MySQL connection string
  // mysql://user:password@host:port/database
  const url = new URL(databaseUrl);
  const dbUser = decodeURIComponent(url.username);
  const dbPassword = decodeURIComponent(url.password);
  const host = url.hostname;
  const port = parseInt(url.port || "3306");
  const database = url.pathname.slice(1);

  console.log(`🔌 Connecting to MySQL at ${host}:${port}/${database} ...`);

  const connection = await mysql.createConnection({ host, port, user: dbUser, password: dbPassword, database });
  console.log("✅ Connected to database");

  // Check if any admin already exists
  const [rows] = await connection.execute(
    "SELECT COUNT(*) AS count FROM users WHERE role = 'admin'",
  );
  const adminCount = rows[0].count;

  if (adminCount > 0) {
    console.log(`⚠️  There are already ${adminCount} admin(s) in the database.`);
    console.log("   You can manage admins via the /admin/users page.");
    console.log("   If you need to create a new admin, use that page instead.");
    await connection.end();
    process.exit(0);
  }

  // No admin exists, prompt for credentials
  const readline = (await import("readline")).default;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

  console.log("\n📝 No admin found. Let's create the first admin account.\n");

  const email = await ask("Email: ");
  if (!email || !email.includes("@")) {
    console.error("❌ Invalid email address");
    await connection.end();
    process.exit(1);
  }

  const name = await ask("Display name: ") || "Admin";

  let password = "";
  while (password.length < 6) {
    password = await ask("Password (min 6 chars): ");
    if (password.length < 6) {
      console.log("❌ Password must be at least 6 characters");
    }
  }

  rl.close();

  // Check if user with this email already exists
  const [existing] = await connection.execute(
    "SELECT id FROM users WHERE email = ?",
    [email],
  );

  if (existing.length > 0) {
    // Upgrade to admin
    const hashedPassword = await bcrypt.hash(password, 10);
    await connection.execute(
      "UPDATE users SET password = ?, role = 'admin', name = ? WHERE email = ?",
      [hashedPassword, name, email],
    );
    console.log(`✅ Upgraded existing user "${email}" to admin`);
  } else {
    // Create new admin user
    const hashedPassword = await bcrypt.hash(password, 10);
    await connection.execute(
      `INSERT INTO users (name, email, password, role, emailVerified, createdAt, updatedAt, lastSignInAt)
       VALUES (?, ?, ?, 'admin', TRUE, NOW(), NOW(), NOW())`,
      [name, email, hashedPassword],
    );
    console.log(`✅ Admin account created: ${email}`);
  }

  await connection.end();
  console.log("\n🎉 You can now log in with this account and manage other admins via /admin/users");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
