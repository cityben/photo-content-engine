#!/usr/bin/env node
/**
 * Create an AUTH_USERS entry for one person.
 *
 *   npm run hash-password -- you@example.com
 *
 * Prompts for the password without echoing it, and prints `email|hash` to
 * add to AUTH_USERS (comma-separate multiple people).
 */

import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/lib/passwords.js";

function prompt(question) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    if (!stdin.isTTY) {
      let data = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (chunk) => (data += chunk));
      stdin.on("end", () => resolve(data.split(/\r?\n/)[0]));
      return;
    }
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (char) => {
      if (char === "\r" || char === "\n" || char === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        stdout.write("\n");
        resolve(value);
      } else if (char === "\u0003") {
        stdout.write("\n");
        process.exit(130);
      } else if (char === "\u007f" || char === "\b") {
        value = value.slice(0, -1);
      } else {
        value += char;
      }
    };
    stdin.on("data", onData);
  });
}

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email.includes("@") || /[|,]/.test(email)) {
  console.error("Usage: npm run hash-password -- you@example.com");
  process.exit(1);
}

const password = await prompt(`Password for ${email} (min ${MIN_PASSWORD_LENGTH} characters): `);
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  process.exit(1);
}
if (process.stdin.isTTY) {
  const confirm = await prompt("Repeat password: ");
  if (confirm !== password) {
    console.error("Passwords don't match.");
    process.exit(1);
  }
}

console.log("\nAdd this to AUTH_USERS (comma-separate multiple people):\n");
console.log(`${email}|${await hashPassword(password)}`);
